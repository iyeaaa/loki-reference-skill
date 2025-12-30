CXX = g++
CXXFLAGS = -O3 -std=c++17 -pthread -Wall
LDFLAGS = -lpq
INCLUDES = -I/usr/include/postgresql -I/usr/pgsql-16/include -I/usr/pgsql-17/include

TARGET = import_leads
SRC = import_leads.cpp

.PHONY: all clean install

all: $(TARGET)

$(TARGET): $(SRC)
	$(CXX) $(CXXFLAGS) $(INCLUDES) -o $@ $< $(LDFLAGS)

clean:
	rm -f $(TARGET)

install: $(TARGET)
	cp $(TARGET) /usr/local/bin/

# Docker commands
up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

# Import commands
import:
	./$(TARGET) -D /home/ec2-user/data_with_website -t $$(nproc)

import-full:
	./$(TARGET) -D /home/ec2-user/data -t $$(nproc)

# Database commands
psql:
	PGPASSWORD=D6HblnSek1IC51Qh5D76Kb7kdbsazdAQ psql -h localhost -p 5433 -U leads_admin -d leads_db

stats:
	PGPASSWORD=D6HblnSek1IC51Qh5D76Kb7kdbsazdAQ psql -h localhost -p 5433 -U leads_admin -d leads_db -c "SELECT * FROM leads_stats LIMIT 20;"

count:
	PGPASSWORD=D6HblnSek1IC51Qh5D76Kb7kdbsazdAQ psql -h localhost -p 5433 -U leads_admin -d leads_db -c "SELECT COUNT(*) as total_leads FROM leads;"
