import csv
from collections import OrderedDict

# Read the TSV file
input_file = '/Users/icheolhui/Mirror/Github/1_Projects/send-grid-test/csv/tsv1.tsv'
output_file = '/Users/icheolhui/Mirror/Github/1_Projects/send-grid-test/csv/tsv1_processed.tsv'

# Store unique records by final_url
unique_records = OrderedDict()

with open(input_file, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f, delimiter='\t')
    headers = reader.fieldnames

    for row in reader:
        final_url = row['final_url']

        # Keep only the first occurrence of each final_url
        if final_url not in unique_records:
            unique_records[final_url] = row

# Now split rows with multiple emails
processed_rows = []

for final_url, row in unique_records.items():
    email_field = row['email']

    if email_field:
        # Split by comma and strip whitespace
        emails = [e.strip() for e in email_field.split(',')]

        # Create a separate row for each email
        for email in emails:
            new_row = row.copy()
            new_row['email'] = email
            processed_rows.append(new_row)
    else:
        # No email, keep the row as is
        processed_rows.append(row)

# Write the processed data to a new TSV file
with open(output_file, 'w', encoding='utf-8', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=headers, delimiter='\t')
    writer.writeheader()
    writer.writerows(processed_rows)

print(f"Processing complete!")
print(f"Original rows: {len(unique_records)}")
print(f"Processed rows (after splitting emails): {len(processed_rows)}")
print(f"Output saved to: {output_file}")
