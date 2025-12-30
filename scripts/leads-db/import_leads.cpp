/**
 * High-Performance Parallel CSV to PostgreSQL Importer
 *
 * Features:
 * - Multi-threaded file processing
 * - PostgreSQL COPY protocol for bulk inserts
 * - Connection pooling
 * - Progress tracking
 * - Error handling and recovery
 *
 * Compile: g++ -O3 -std=c++17 -pthread -o import_leads import_leads.cpp -lpq
 */

#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>
#include <queue>
#include <thread>
#include <mutex>
#include <condition_variable>
#include <atomic>
#include <filesystem>
#include <chrono>
#include <cstring>
#include <regex>
#include <libpq-fe.h>

namespace fs = std::filesystem;

// Configuration
struct Config {
    std::string db_host = "localhost";
    std::string db_port = "5433";
    std::string db_name = "leads_db";
    std::string db_user = "leads_admin";
    std::string db_password = "D6HblnSek1IC51Qh5D76Kb7kdbsazdAQ";
    std::string data_dir = "/home/ec2-user/data_with_website";
    int num_threads = 8;
    int batch_size = 10000;
    bool use_website_only = true;
};

// Global stats
std::atomic<uint64_t> total_rows_imported{0};
std::atomic<uint64_t> total_files_processed{0};
std::atomic<uint64_t> total_errors{0};
std::mutex cout_mutex;

// Thread-safe logging
void log(const std::string& msg) {
    std::lock_guard<std::mutex> lock(cout_mutex);
    auto now = std::chrono::system_clock::now();
    auto time = std::chrono::system_clock::to_time_t(now);
    std::cout << "[" << std::put_time(std::localtime(&time), "%H:%M:%S") << "] " << msg << std::endl;
}

// Escape string for PostgreSQL COPY format
std::string escape_copy_string(const std::string& str) {
    std::string result;
    result.reserve(str.size() * 1.1);
    for (char c : str) {
        switch (c) {
            case '\\': result += "\\\\"; break;
            case '\n': result += "\\n"; break;
            case '\r': result += "\\r"; break;
            case '\t': result += "\\t"; break;
            default: result += c;
        }
    }
    return result;
}

// Parse CSV line respecting quoted fields
std::vector<std::string> parse_csv_line(const std::string& line) {
    std::vector<std::string> fields;
    std::string field;
    bool in_quotes = false;
    bool prev_quote = false;

    for (size_t i = 0; i < line.size(); ++i) {
        char c = line[i];

        if (c == '"') {
            if (in_quotes && i + 1 < line.size() && line[i + 1] == '"') {
                field += '"';
                ++i;
            } else {
                in_quotes = !in_quotes;
            }
        } else if (c == ',' && !in_quotes) {
            fields.push_back(field);
            field.clear();
        } else {
            field += c;
        }
    }
    fields.push_back(field);

    return fields;
}

// Extract country name from folder path
std::string extract_country(const std::string& filepath) {
    fs::path p(filepath);
    std::string parent = p.parent_path().filename().string();
    std::string grandparent = p.parent_path().parent_path().filename().string();

    // Handle nested structures like "USA Total/USA Emails.csv"
    if (parent.find("Total") != std::string::npos ||
        parent.find("Emails") != std::string::npos ||
        parent.find("Email") != std::string::npos) {
        parent = grandparent;
    }

    // Remove leading numbers like "1. United States"
    std::regex num_prefix(R"(^\d+\.\s*)");
    parent = std::regex_replace(parent, num_prefix, "");

    return parent;
}

// Create database connection
PGconn* create_connection(const Config& config) {
    std::string conninfo =
        "host=" + config.db_host +
        " port=" + config.db_port +
        " dbname=" + config.db_name +
        " user=" + config.db_user +
        " password=" + config.db_password;

    PGconn* conn = PQconnectdb(conninfo.c_str());

    if (PQstatus(conn) != CONNECTION_OK) {
        log("Connection failed: " + std::string(PQerrorMessage(conn)));
        PQfinish(conn);
        return nullptr;
    }

    return conn;
}

// Column mapping (CSV index -> field name)
// CSV: Full name,Industry,Job title,Sub Role,Emails,Mobile,Phone numbers,Company Name,
//      Company Industry,Company Website,Company Size,Location,Skills,First Name,Last Name,
//      Birth Year,Birth Date,Gender,LinkedIn Url,Facebook Url,Twitter Url,Github Url,
//      Company Linkedin Url,Company Facebook Url,Company Twitter Url,Company Location Name,
//      Company Location Street Address,Company Location Address Line 2,Company Location Postal Code,
//      Location Country,Location Continent,Linkedin Connections,Inferred Salary,Years Experience,
//      Countries,Interests

// Build COPY row from CSV fields
std::string build_copy_row(const std::vector<std::string>& fields, const std::string& country) {
    if (fields.size() < 36) return "";

    std::ostringstream row;

    // country (added column)
    row << escape_copy_string(country) << "\t";

    // full_name (0)
    row << escape_copy_string(fields[0]) << "\t";
    // first_name (13)
    row << escape_copy_string(fields[13]) << "\t";
    // last_name (14)
    row << escape_copy_string(fields[14]) << "\t";
    // birth_year (15)
    row << escape_copy_string(fields[15]) << "\t";
    // birth_date (16)
    row << escape_copy_string(fields[16]) << "\t";
    // gender (17)
    row << escape_copy_string(fields[17]) << "\t";

    // industry (1)
    row << escape_copy_string(fields[1]) << "\t";
    // job_title (2)
    row << escape_copy_string(fields[2]) << "\t";
    // sub_role (3)
    row << escape_copy_string(fields[3]) << "\t";
    // skills (12)
    row << escape_copy_string(fields[12]) << "\t";
    // years_experience (33)
    row << escape_copy_string(fields[33]) << "\t";
    // inferred_salary (32)
    row << escape_copy_string(fields[32]) << "\t";

    // emails (4)
    row << escape_copy_string(fields[4]) << "\t";
    // mobile (5)
    row << escape_copy_string(fields[5]) << "\t";
    // phone_numbers (6)
    row << escape_copy_string(fields[6]) << "\t";

    // linkedin_url (18)
    row << escape_copy_string(fields[18]) << "\t";
    // facebook_url (19)
    row << escape_copy_string(fields[19]) << "\t";
    // twitter_url (20)
    row << escape_copy_string(fields[20]) << "\t";
    // github_url (21)
    row << escape_copy_string(fields[21]) << "\t";
    // linkedin_connections (31)
    row << escape_copy_string(fields[31]) << "\t";

    // company_name (7)
    row << escape_copy_string(fields[7]) << "\t";
    // company_industry (8)
    row << escape_copy_string(fields[8]) << "\t";
    // company_website (9)
    row << escape_copy_string(fields[9]) << "\t";
    // company_size (10)
    row << escape_copy_string(fields[10]) << "\t";
    // company_linkedin_url (22)
    row << escape_copy_string(fields[22]) << "\t";
    // company_facebook_url (23)
    row << escape_copy_string(fields[23]) << "\t";
    // company_twitter_url (24)
    row << escape_copy_string(fields[24]) << "\t";

    // location (11)
    row << escape_copy_string(fields[11]) << "\t";
    // location_country (29)
    row << escape_copy_string(fields[29]) << "\t";
    // location_continent (30)
    row << escape_copy_string(fields[30]) << "\t";
    // company_location_name (25)
    row << escape_copy_string(fields[25]) << "\t";
    // company_location_street_address (26)
    row << escape_copy_string(fields[26]) << "\t";
    // company_location_address_line_2 (27)
    row << escape_copy_string(fields[27]) << "\t";
    // company_location_postal_code (28)
    row << escape_copy_string(fields[28]) << "\t";

    // countries (34)
    row << escape_copy_string(fields[34]) << "\t";
    // interests (35)
    row << escape_copy_string(fields[35]) << "\n";

    return row.str();
}

// Import a single CSV file
bool import_file(const std::string& filepath, const Config& config) {
    std::string country = extract_country(filepath);
    log("Starting import: " + filepath + " (Country: " + country + ")");

    PGconn* conn = create_connection(config);
    if (!conn) {
        total_errors++;
        return false;
    }

    std::ifstream file(filepath);
    if (!file.is_open()) {
        log("Failed to open file: " + filepath);
        PQfinish(conn);
        total_errors++;
        return false;
    }

    // Skip header
    std::string line;
    if (!std::getline(file, line)) {
        log("Empty file: " + filepath);
        PQfinish(conn);
        return true;
    }

    // Start COPY command
    const char* copy_cmd =
        "COPY leads (country, full_name, first_name, last_name, birth_year, birth_date, gender, "
        "industry, job_title, sub_role, skills, years_experience, inferred_salary, "
        "emails, mobile, phone_numbers, "
        "linkedin_url, facebook_url, twitter_url, github_url, linkedin_connections, "
        "company_name, company_industry, company_website, company_size, "
        "company_linkedin_url, company_facebook_url, company_twitter_url, "
        "location, location_country, location_continent, "
        "company_location_name, company_location_street_address, "
        "company_location_address_line_2, company_location_postal_code, "
        "countries, interests) FROM STDIN";

    PGresult* res = PQexec(conn, copy_cmd);
    if (PQresultStatus(res) != PGRES_COPY_IN) {
        log("COPY command failed: " + std::string(PQerrorMessage(conn)));
        PQclear(res);
        PQfinish(conn);
        total_errors++;
        return false;
    }
    PQclear(res);

    uint64_t rows = 0;
    uint64_t errors = 0;

    while (std::getline(file, line)) {
        if (line.empty()) continue;

        // Remove BOM if present
        if (line.size() >= 3 &&
            (unsigned char)line[0] == 0xEF &&
            (unsigned char)line[1] == 0xBB &&
            (unsigned char)line[2] == 0xBF) {
            line = line.substr(3);
        }

        auto fields = parse_csv_line(line);
        if (fields.size() < 36) {
            errors++;
            continue;
        }

        std::string copy_row = build_copy_row(fields, country);
        if (copy_row.empty()) {
            errors++;
            continue;
        }

        if (PQputCopyData(conn, copy_row.c_str(), copy_row.size()) != 1) {
            log("PQputCopyData failed: " + std::string(PQerrorMessage(conn)));
            errors++;
        } else {
            rows++;
        }

        // Progress log every 100k rows
        if (rows % 100000 == 0) {
            log(filepath + ": " + std::to_string(rows) + " rows imported...");
        }
    }

    // End COPY
    if (PQputCopyEnd(conn, nullptr) != 1) {
        log("PQputCopyEnd failed: " + std::string(PQerrorMessage(conn)));
        PQfinish(conn);
        total_errors++;
        return false;
    }

    res = PQgetResult(conn);
    if (PQresultStatus(res) != PGRES_COMMAND_OK) {
        log("COPY completion failed: " + std::string(PQerrorMessage(conn)));
        PQclear(res);
        PQfinish(conn);
        total_errors++;
        return false;
    }
    PQclear(res);

    file.close();
    PQfinish(conn);

    total_rows_imported += rows;
    total_files_processed++;

    log("Completed: " + filepath + " - " + std::to_string(rows) + " rows (errors: " + std::to_string(errors) + ")");

    return true;
}

// Worker thread function
void worker(std::queue<std::string>& files, std::mutex& queue_mutex, const Config& config) {
    while (true) {
        std::string filepath;
        {
            std::lock_guard<std::mutex> lock(queue_mutex);
            if (files.empty()) return;
            filepath = files.front();
            files.pop();
        }
        import_file(filepath, config);
    }
}

// Collect all CSV files recursively
std::vector<std::string> collect_csv_files(const std::string& dir) {
    std::vector<std::string> files;

    for (const auto& entry : fs::recursive_directory_iterator(dir)) {
        if (entry.is_regular_file()) {
            std::string ext = entry.path().extension().string();
            std::transform(ext.begin(), ext.end(), ext.begin(), ::tolower);
            if (ext == ".csv") {
                files.push_back(entry.path().string());
            }
        }
    }

    // Sort by file size (largest first) for better load balancing
    std::sort(files.begin(), files.end(), [](const std::string& a, const std::string& b) {
        return fs::file_size(a) > fs::file_size(b);
    });

    return files;
}

void print_usage(const char* prog) {
    std::cout << "Usage: " << prog << " [options]\n"
              << "Options:\n"
              << "  -h, --host HOST       PostgreSQL host (default: localhost)\n"
              << "  -p, --port PORT       PostgreSQL port (default: 5433)\n"
              << "  -d, --dbname NAME     Database name (default: leads_db)\n"
              << "  -U, --user USER       Username (default: leads_admin)\n"
              << "  -W, --password PASS   Password\n"
              << "  -D, --datadir DIR     Data directory (default: /home/ec2-user/data_with_website)\n"
              << "  -t, --threads N       Number of threads (default: 8)\n"
              << "  --help                Show this help\n";
}

int main(int argc, char* argv[]) {
    Config config;

    // Parse command line arguments
    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if ((arg == "-h" || arg == "--host") && i + 1 < argc) {
            config.db_host = argv[++i];
        } else if ((arg == "-p" || arg == "--port") && i + 1 < argc) {
            config.db_port = argv[++i];
        } else if ((arg == "-d" || arg == "--dbname") && i + 1 < argc) {
            config.db_name = argv[++i];
        } else if ((arg == "-U" || arg == "--user") && i + 1 < argc) {
            config.db_user = argv[++i];
        } else if ((arg == "-W" || arg == "--password") && i + 1 < argc) {
            config.db_password = argv[++i];
        } else if ((arg == "-D" || arg == "--datadir") && i + 1 < argc) {
            config.data_dir = argv[++i];
        } else if ((arg == "-t" || arg == "--threads") && i + 1 < argc) {
            config.num_threads = std::stoi(argv[++i]);
        } else if (arg == "--help") {
            print_usage(argv[0]);
            return 0;
        }
    }

    // Auto-detect number of threads if not specified
    if (config.num_threads <= 0) {
        config.num_threads = std::thread::hardware_concurrency();
        if (config.num_threads == 0) config.num_threads = 8;
    }

    log("=== Leads Database Importer ===");
    log("Host: " + config.db_host + ":" + config.db_port);
    log("Database: " + config.db_name);
    log("Data directory: " + config.data_dir);
    log("Threads: " + std::to_string(config.num_threads));

    // Test connection
    PGconn* test_conn = create_connection(config);
    if (!test_conn) {
        log("Failed to connect to database. Exiting.");
        return 1;
    }
    log("Database connection successful.");
    PQfinish(test_conn);

    // Collect files
    log("Scanning for CSV files...");
    auto files = collect_csv_files(config.data_dir);
    log("Found " + std::to_string(files.size()) + " CSV files");

    if (files.empty()) {
        log("No CSV files found. Exiting.");
        return 1;
    }

    // Calculate total size
    uint64_t total_size = 0;
    for (const auto& f : files) {
        total_size += fs::file_size(f);
    }
    log("Total data size: " + std::to_string(total_size / (1024 * 1024 * 1024)) + " GB");

    // Create work queue
    std::queue<std::string> work_queue;
    for (const auto& f : files) {
        work_queue.push(f);
    }
    std::mutex queue_mutex;

    // Start timer
    auto start_time = std::chrono::high_resolution_clock::now();

    // Launch worker threads
    std::vector<std::thread> threads;
    for (int i = 0; i < config.num_threads; ++i) {
        threads.emplace_back(worker, std::ref(work_queue), std::ref(queue_mutex), std::ref(config));
    }

    // Wait for all threads to complete
    for (auto& t : threads) {
        t.join();
    }

    // End timer
    auto end_time = std::chrono::high_resolution_clock::now();
    auto duration = std::chrono::duration_cast<std::chrono::seconds>(end_time - start_time);

    // Print summary
    log("=== Import Complete ===");
    log("Files processed: " + std::to_string(total_files_processed.load()));
    log("Total rows imported: " + std::to_string(total_rows_imported.load()));
    log("Total errors: " + std::to_string(total_errors.load()));
    log("Time elapsed: " + std::to_string(duration.count()) + " seconds");

    if (duration.count() > 0) {
        double rows_per_sec = static_cast<double>(total_rows_imported.load()) / duration.count();
        log("Average speed: " + std::to_string(static_cast<uint64_t>(rows_per_sec)) + " rows/sec");
    }

    return (total_errors > 0) ? 1 : 0;
}
