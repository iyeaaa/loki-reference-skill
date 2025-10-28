/**
 * i18next-scanner 설정 파일
 * 소스 코드에서 t('key') 형태의 번역 키를 자동으로 스캔
 */

module.exports = {
  input: [
    "src/**/*.{ts,tsx}",
    // HTML 파일도 스캔하려면 추가
    // '!src/**/*.spec.{ts,tsx}', // 테스트 파일 제외
  ],
  output: "./locales/.scanned",
  options: {
    debug: false,
    removeUnusedKeys: false, // 사용하지 않는 키 제거하지 않음
    sort: true, // 키를 알파벳순으로 정렬
    func: {
      list: ["t", "i18next.t", "i18n.t"], // 스캔할 함수명
      extensions: [".ts", ".tsx"],
    },
    trans: {
      component: "Trans",
      i18nKey: "i18nKey",
      defaultsKey: "defaults",
      extensions: [".tsx"],
      fallbackKey: false,
    },
    lngs: ["ko", "en"], // 지원할 언어
    ns: ["translation"], // 네임스페이스
    defaultLng: "ko",
    defaultNs: "translation",
    defaultValue: (lng, ns, key) => {
      // 기본값 설정 (스캔된 키에 대한 임시 값)
      if (lng === "ko") {
        return `[번역 필요] ${key}`
      }
      return `[Translation needed] ${key}`
    },
    resource: {
      loadPath: "locales/.scanned/{{lng}}/{{ns}}.json",
      savePath: "{{lng}}/{{ns}}.json",
      jsonIndent: 2,
      lineEnding: "\n",
    },
    nsSeparator: false, // ':' 구분자 사용 안 함
    keySeparator: ".", // '.' 구분자 사용 (common.welcome)
    pluralSeparator: "_",
    contextSeparator: "_",
    interpolation: {
      prefix: "{{",
      suffix: "}}",
    },
  },
}

