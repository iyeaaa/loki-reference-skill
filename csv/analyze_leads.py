#!/usr/bin/env python3
"""
USA 리드 데이터 분석 및 액기스 리드 추출 스크립트
Pandas 사용 (인코딩/이스케이프 문제에 강함)
"""

import pandas as pd
from pathlib import Path
import time
import warnings

warnings.filterwarnings('ignore')

# 설정
INPUT_FILE = Path(__file__).parent / "USA_0.csv"
OUTPUT_DIR = Path(__file__).parent / "filtered"

# 타겟 산업군 (수정 가능)
TARGET_INDUSTRIES = [
    "beauty",
    "cosmetics", 
    "skincare",
    "spa",
    "wellness",
    "health",
    "healthcare",
    "retail",
    "e-commerce",
    "fashion",
    "luxury goods",
    "consumer goods",
]

def analyze_csv():
    """CSV 파일 전체 분석"""
    print("=" * 60)
    print("📊 USA 리드 데이터 분석 시작")
    print("=" * 60)
    
    start_time = time.time()
    
    # CSV 읽기 (Pandas는 인코딩 문제 관대함)
    print(f"\n📁 파일 읽는 중: {INPUT_FILE}")
    df = pd.read_csv(
        INPUT_FILE, 
        encoding='latin-1',  # 모든 바이트 처리 가능
        on_bad_lines='skip',  # 문제 있는 행 건너뛰기
        low_memory=False,
        dtype=str,  # 모든 컬럼을 문자열로
    )
    
    read_time = time.time() - start_time
    print(f"✅ 읽기 완료! ({read_time:.2f}초)")
    
    # 기본 통계
    total_rows = len(df)
    print(f"\n📈 총 레코드 수: {total_rows:,}개")
    
    # 컬럼 목록
    print(f"\n📋 컬럼 목록 ({len(df.columns)}개):")
    for col in df.columns:
        print(f"   - {col}")
    
    # 이메일 통계
    print("\n" + "=" * 60)
    print("📧 이메일 분석")
    print("=" * 60)
    
    has_email = df[df['Emails'].notna() & (df['Emails'] != '')]
    email_count = len(has_email)
    email_percent = (email_count / total_rows) * 100
    print(f"   이메일 있는 리드: {email_count:,}개 ({email_percent:.1f}%)")
    print(f"   이메일 없는 리드: {total_rows - email_count:,}개")
    
    # 산업별 통계
    print("\n" + "=" * 60)
    print("🏭 산업별 분포 (상위 20개)")
    print("=" * 60)
    
    industry_counts = df[df['Industry'].notna() & (df['Industry'] != '')]['Industry'].value_counts().head(20)
    
    for industry, count in industry_counts.items():
        percent = (count / total_rows) * 100
        print(f"   {industry}: {count:,}개 ({percent:.1f}%)")
    
    # Company Industry 통계
    print("\n" + "=" * 60)
    print("🏢 회사 산업별 분포 (상위 20개)")
    print("=" * 60)
    
    company_industry_counts = df[df['Company Industry'].notna() & (df['Company Industry'] != '')]['Company Industry'].value_counts().head(20)
    
    for industry, count in company_industry_counts.items():
        percent = (count / total_rows) * 100
        print(f"   {industry}: {count:,}개 ({percent:.1f}%)")
    
    # 회사 크기별 통계
    print("\n" + "=" * 60)
    print("📏 회사 크기별 분포")
    print("=" * 60)
    
    size_counts = df[df['Company Size'].notna() & (df['Company Size'] != '')]['Company Size'].value_counts()
    
    for size, count in size_counts.items():
        percent = (count / total_rows) * 100
        print(f"   {size}: {count:,}개 ({percent:.1f}%)")
    
    # Job Title 통계
    print("\n" + "=" * 60)
    print("💼 직책별 분포 (상위 20개)")
    print("=" * 60)
    
    job_counts = df[df['Job title'].notna() & (df['Job title'] != '')]['Job title'].value_counts().head(20)
    
    for job, count in job_counts.items():
        percent = (count / total_rows) * 100
        print(f"   {job}: {count:,}개 ({percent:.1f}%)")
    
    total_time = time.time() - start_time
    print("\n" + "=" * 60)
    print(f"⏱️  총 분석 시간: {total_time:.2f}초")
    print("=" * 60)
    
    return df


def extract_active_leads(df: pd.DataFrame):
    """액기스 리드 추출 (이메일 있고, 타겟 산업)"""
    print("\n" + "=" * 60)
    print("🎯 액기스 리드 추출 시작")
    print("=" * 60)
    
    start_time = time.time()
    
    # 산업 필터 생성 (대소문자 무시)
    def matches_target_industry(row):
        industry = str(row.get('Industry', '')).lower()
        company_industry = str(row.get('Company Industry', '')).lower()
        
        for target in TARGET_INDUSTRIES:
            if target in industry or target in company_industry:
                return True
        return False
    
    # 이메일이 있는 리드만
    has_email = df[df['Emails'].notna() & (df['Emails'] != '')]
    print(f"\n📧 이메일 있는 리드: {len(has_email):,}개")
    
    # 타겟 산업 필터링 (벡터화)
    industry_lower = has_email['Industry'].fillna('').str.lower()
    company_industry_lower = has_email['Company Industry'].fillna('').str.lower()
    
    industry_mask = pd.Series(False, index=has_email.index)
    for target in TARGET_INDUSTRIES:
        industry_mask = industry_mask | industry_lower.str.contains(target, na=False)
        industry_mask = industry_mask | company_industry_lower.str.contains(target, na=False)
    
    active_leads = has_email[industry_mask]
    
    print(f"📊 타겟 산업 리드: {len(active_leads):,}개")
    
    # 회사 정보가 있는 리드 우선
    premium_leads = active_leads[
        active_leads['Company Name'].notna() & 
        (active_leads['Company Name'] != '') &
        active_leads['Job title'].notna() & 
        (active_leads['Job title'] != '')
    ]
    
    print(f"   └─ 회사명 + 직책 있는 리드: {len(premium_leads):,}개")
    
    # 출력 디렉토리 생성
    OUTPUT_DIR.mkdir(exist_ok=True)
    
    # 산업별로 저장
    print("\n📁 산업별 파일 저장 중...")
    
    for industry in TARGET_INDUSTRIES:
        industry_mask = (
            industry_lower.str.contains(industry, na=False) | 
            company_industry_lower.str.contains(industry, na=False)
        )
        industry_leads = has_email[industry_mask]
        
        if len(industry_leads) > 0:
            output_file = OUTPUT_DIR / f"USA_{industry}_leads.csv"
            industry_leads.to_csv(output_file, index=False)
            print(f"   ✅ {industry}: {len(industry_leads):,}개 → {output_file.name}")
    
    # 전체 액기스 리드도 저장
    all_active_file = OUTPUT_DIR / "USA_all_active_leads.csv"
    active_leads.to_csv(all_active_file, index=False)
    print(f"\n   📦 전체 액기스: {len(active_leads):,}개 → {all_active_file.name}")
    
    # 프리미엄 리드 저장
    premium_file = OUTPUT_DIR / "USA_premium_leads.csv"
    premium_leads.to_csv(premium_file, index=False)
    print(f"   ⭐ 프리미엄: {len(premium_leads):,}개 → {premium_file.name}")
    
    extract_time = time.time() - start_time
    print(f"\n⏱️  추출 시간: {extract_time:.2f}초")
    
    return active_leads, premium_leads


def main():
    """메인 실행 함수"""
    print("\n🚀 Pandas 리드 분석 스크립트 v1.0\n")
    
    # 1. 분석
    df = analyze_csv()
    
    # 2. 액기스 추출
    active, premium = extract_active_leads(df)
    
    # 요약
    print("\n" + "=" * 60)
    print("📋 최종 요약")
    print("=" * 60)
    print(f"   원본 데이터: {len(df):,}개")
    print(f"   액기스 리드: {len(active):,}개 ({len(active)/len(df)*100:.1f}%)")
    print(f"   프리미엄 리드: {len(premium):,}개 ({len(premium)/len(df)*100:.1f}%)")
    print(f"\n   💾 저장 위치: {OUTPUT_DIR.absolute()}")
    print("=" * 60)


if __name__ == "__main__":
    main()
