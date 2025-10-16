#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import csv

input_file = '오사카.csv'
output_file = '오사카_분리.csv'

# Read the CSV file and split emails
rows = []
with open(input_file, 'r', encoding='utf-8') as f:
    reader = csv.reader(f)
    header = next(reader)
    rows.append(header)

    # Find the recipient email column index (수신인)
    email_col_idx = header.index('수신인') if '수신인' in header else -1

    for row in reader:
        if email_col_idx == -1 or len(row) <= email_col_idx:
            rows.append(row)
            continue

        # Get the email cell
        email_cell = row[email_col_idx]

        # Split by comma
        emails = [email.strip() for email in email_cell.split(',') if email.strip()]

        if len(emails) <= 1:
            # No split needed
            rows.append(row)
        else:
            # Create a new row for each email
            for email in emails:
                new_row = row.copy()
                new_row[email_col_idx] = email
                rows.append(new_row)

# Write to output file
with open(output_file, 'w', encoding='utf-8', newline='') as f:
    writer = csv.writer(f)
    writer.writerows(rows)

print(f'처리 완료: {len(rows) - 1}개 행 (헤더 제외)')
print(f'출력 파일: {output_file}')
