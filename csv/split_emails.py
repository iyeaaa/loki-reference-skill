#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import csv

input_file = '익투스.tsv'
output_file = '익투스_분리.tsv'

# Read the TSV file and split emails
rows = []
with open(input_file, 'r', encoding='utf-8') as f:
    reader = csv.reader(f, delimiter='\t')
    header = next(reader)
    rows.append(header)

    # Find the email column index
    email_col_idx = header.index('이메일') if '이메일' in header else -1

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
    writer = csv.writer(f, delimiter='\t')
    writer.writerows(rows)

print(f'처리 완료: {len(rows) - 1}개 행 (헤더 제외)')
print(f'출력 파일: {output_file}')
