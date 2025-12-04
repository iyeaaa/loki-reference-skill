(async () => {
  const all = [];
  const limit = 10;
  const totalCount = 3153;

  // Authorization 토큰 (Network 탭에서 복사)
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzY1NDM4NTY1LCJpYXQiOjE3NjQ4MzM3NjUsImp0aSI6IjljMzM2YWFhNWZiZDRkOTZiMDNjZTk4MTBiZTg1ZGRhIiwidXNlcl9pZCI6NTU0OTR9.fwT74sFCnCRUqHvf7U7rnlgrVlmTM0nKQ1KcEruUiMc';

  console.log('========================================');
  console.log('=== 스크래핑 시작 ===');
  console.log('토큰:', token ? '있음 (' + token.substring(0, 20) + '...)' : '없음');
  console.log('========================================');

  for (let offset = 0; offset < totalCount; offset += limit) {
    const requestNum = Math.floor(offset / limit) + 1;

    console.log(`\n--- 요청 #${requestNum} (offset=${offset}) ---`);

    try {
      const url = `https://api.comeup.org/v1/startup_profile/?limit=${limit}&offset=${offset}`;

      const headers = {
        'Content-Type': 'application/json',
        'Accept': '*/*'
      };

      if (token) {
        headers['Authorization'] = 'Bearer ' + token;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: headers
      });

      const data = await response.json();

      // 빈 결과일 때 전체 응답 출력
      if (!data.results || data.results.length === 0) {
        console.log('!!! 전체 응답 데이터 !!!');
        console.log(JSON.stringify(data, null, 2));
      }

      console.log('HTTP:', response.status, '| count:', data.count, '| isNext:', data.isNext, '| results:', data.results?.length);

      if (data.results && data.results.length > 0) {
        all.push(...data.results);
        console.log('✓ 현재 총:', all.length);
      } else {
        console.warn('⚠ results 비어있음!');
        if (data.count <= all.length) {
          console.log('모든 데이터 수집 완료');
          break;
        }
      }

      await new Promise(r => setTimeout(r, 500));

    } catch (error) {
      console.error('에러:', error.message);
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log('\n=== 완료: ' + all.length + '개 ===');

  if (all.length === 0) {
    alert('수집된 데이터가 없습니다!');
    return;
  }

  const csv = 'Company,Introduction,CEO,Industry,Funding,Country,Website,LogoImage,BusinessDocKR,BusinessDocEN\n' + all.map(d =>
    `"${(d.companyNameEn || d.companyNameKr || '').replace(/"/g, '""')}","${(d.startupCompanyIntroEn || d.startupCompanyIntroKr || '').replace(/"/g, '""').replace(/[\n\r]/g, ' ')}","${(d.ceoNameEn || d.ceoNameKr || '').replace(/"/g, '""')}","${d.startupIndustry || ''}","${d.startupFundingRound || ''}","${d.country || ''}","${d.homepageUrl || ''}","${d.logoImage || ''}","${d.startupBusinessDocKr || ''}","${d.startupBusinessDocEn || ''}"`
  ).join('\n');

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'comeup_startups.csv';
  a.click();

  alert('완료: ' + all.length + '개');
})();
