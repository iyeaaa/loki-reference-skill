# Country Leads 폴더 구조

**업데이트:** 2025-12-30 | **서버:** rinda-duckdb

---

## 요약

| 폴더 | 용량 | 파일 수 | 설명 |
|------|------|--------|------|
| `/home/ec2-user/data/` | 82 GB | 245개 | 원본 (전체 리드) |
| `/home/ec2-user/data_with_website/` | 41 GB | 245개 | Website 있는 리드만 |

---

## 원본 데이터 구조 (`/home/ec2-user/data/`)

```
/home/ec2-user/data/
├── 1. United States
│   ├── USA Emails
│   │   └── USA Emails.csv
│   └── USA Total
├── 2. United Kingdom
│   ├── UK Emails
│   │   └── UK Emails.csv
│   └── UK Total
│       └── UK Totals.csv
├── 3. Canada
│   ├── Canada Emails
│   │   └── Canada Emails.csv
│   └── Canada Total
│       └── Canada Total.csv
├── 4. Australia
│   ├── Australia Total
│   │   └── Australia Total.csv
│   └── Australia with emails
│       └── Australia Emails.csv
├── Albania
│   ├── Albania.csv
│   └── albaniaEmails.csv
├── Algeria
│   ├── Algeria.csv
│   └── algeriaEmails.csv
├── Andorra
│   ├── Andorra.csv
│   └── AndorraEmails.csv
├── Argentina
│   ├── Argentina Emails
│   │   └── ArgentinaEmails Total.csv
│   └── Argentina Total
│       └── Argentina Total.csv
├── Armenia
│   ├── Armenia.csv
│   └── ArmeniaEmails.csv
├── Austria
│   ├── Austria.csv
│   └── AustriaEmails.csv
├── Azerbaijan
│   ├── Azerbaijan.csv
│   └── AzerbaijanEmails.csv
├── Bahamas
│   ├── Bahamas.csv
│   └── BahamasEmails.csv
├── Bahrain
│   ├── Bahrain.csv
│   └── BahrainEmails.csv
├── Bangladesh
│   ├── Bangladesh.csv
│   └── BangladeshEmails.csv
├── Belarus
│   ├── Belarus.csv
│   └── BelarusEmails.csv
├── Belgium
│   ├── Belgium Emails
│   │   └── BelgiumEmails.csv
│   └── Belgium Total
│       └── Belgium.csv
├── Belize
│   ├── Belize.csv
│   └── BelizeEmails.csv
├── Benin
│   ├── Benin.csv
│   └── BeninEmails.csv
├── Bhutan
│   ├── Bhutan.csv
│   └── BhutanEmails.csv
├── Bolivia
│   ├── Bolivia.csv
│   └── BoliviaEmails.csv
├── Botswana
│   ├── Botswana.csv
│   └── BotswanaEmails.csv
├── Brazil
│   ├── Brazil Emails
│   │   └── brazilemails.csv
│   └── Brazil Total
│       └── Brazil.csv
├── Brunei
│   ├── Brunei.csv
│   └── BruneiEmails.csv
├── Bulgaria
│   ├── Bulgaria.csv
│   └── BulgariaEmails.csv
├── Burundi
│   ├── Burundi.csv
│   └── BurundiEmails.csv
├── Cambodia
│   ├── Cambodia.csv
│   └── CambodiaEmails.csv
├── Cameroon
│   ├── Cameroon.csv
│   └── CameroonEmails.csv
├── Chad
│   ├── Chad.csv
│   └── ChadEmails.csv
├── Chile
│   ├── Chile.csv
│   └── ChileEmails.csv
├── China
│   ├── China Emails
│   │   └── ChinaEmails.csv
│   └── China Total
│       └── China.csv
├── Colombia
│   ├── Colombia Email
│   │   └── ColombiaEmails.csv
│   └── Colombia Total
│       └── Colombia.csv
├── Comoros
│   ├── Comoros.csv
│   └── ComorosEmails.csv
├── Costrarica
│   ├── CostaRica.csv
│   └── CostaRicaEmails.csv
├── Croatia
│   ├── Croatia.csv
│   └── CroatiaEmails.csv
├── Cuba
│   ├── Cuba.csv
│   └── CubaEmails.csv
├── Cyprus
│   ├── Cyprus.csv
│   └── CyprusEmails.csv
├── Denmark
│   ├── Denmark Emails
│   │   └── DenmarkEmails.csv
│   └── Denmark total
│       └── Denmark.csv
├── Djibouti
│   ├── Djibouti.csv
│   └── DjiboutiEmails.csv
├── Dominica
│   ├── Dominica.csv
│   └── DominicaEmails.csv
├── Ecuador
│   ├── Ecuador.csv
│   └── EcuadorEmails.csv
├── Egypt
│   ├── Egypt Emals
│   │   └── EgyptEmails.csv
│   └── Egypt total
│       └── Egypt.csv
├── Elsalvador
│   ├── ElSalvador.csv
│   └── ElSalvadorEmails.csv
├── Eritrea
│   ├── Eritrea.csv
│   └── EritreaEmails.csv
├── Estonia
│   ├── Estonia.csv
│   └── EstoniaEmails.csv
├── Ethiopia
│   ├── Ethiopia.csv
│   └── EthiopiaEmails.csv
├── Fiji
│   ├── Fiji.csv
│   └── FijiEmails.csv
├── Finland
│   ├── Finland.csv
│   └── FinlandEmails.csv
├── France
│   ├── France Emails
│   │   └── FranceEmails.csv
│   └── France Total
│       └── France.csv
├── Gabon
│   ├── Gabon.csv
│   └── GabonEmails.csv
├── Gambia
│   ├── Gambia.csv
│   └── GambiaEmails.csv
├── Georgia
│   ├── Georgia.csv
│   └── GeorgiaEmails.csv
├── Ghana
│   ├── Ghana.csv
│   └── GhanaEmails.csv
├── Greece
│   ├── Greece.csv
│   └── GreeceEmails.csv
├── Grenada
│   ├── Grenada.csv
│   └── GrenadaEmails.csv
├── Guetamala
│   ├── Guatemala.csv
│   └── GuatemalaEmails.csv
├── Haiti
│   ├── Haiti.csv
│   └── HaitiEmails.csv
├── Honduras
│   ├── Honduras.csv
│   └── HondurasEmails.csv
├── Hungary
│   ├── Hungary.csv
│   └── HungaryEmails.csv
├── Iceland
│   ├── Iceland.csv
│   └── IcelandEmails.csv
├── India
│   ├── India Emails
│   │   └── India Emails.csv
│   └── India Total
│       └── India Total.csv
├── Indonesia
│   ├── Indonesia Emails
│   │   └── IndonesiaEmails.csv
│   └── Indonesia Total
│       └── Indonesia.csv
├── Iran
│   ├── Iran.csv
│   └── IranEmails.csv
├── Iraq
│   ├── Iraq.csv
│   └── IraqEmails.csv
├── Israel
│   ├── Israel.csv
│   └── IsraelEmails.csv
├── Italy
│   ├── Italy Emails
│   │   └── ItalyEmails.csv
│   └── Italy Total
│       └── Italy.csv
├── Kyrgyzstan
│   ├── Kyrgyzstan Emails.csv
│   └── Kyrgyzstan.csv
├── Laos
│   ├── Laos.csv
│   └── LaosEmails.csv
├── Libya
│   ├── Libya.csv
│   └── LibyaEmails.csv
├── Liechtenstein
│   ├── Liechtenstein.csv
│   └── LiechtensteinEmails.csv
├── Madagascar
│   ├── Madagascar.csv
│   └── MadagascarEmails.csv
├── Mali
│   ├── Mali.csv
│   └── MaliEmails.csv
├── Malta
│   ├── Malta.csv
│   └── MaltaEmails.csv
├── Mexico
│   ├── Mexico Emails
│   │   └── MexicoEmails.csv
│   └── Mexico Total
│       └── Mexico.csv
├── Moldova
│   ├── Moldova.csv
│   └── MoldovaEmails.csv
├── Monaco
│   ├── Monaco.csv
│   └── MonacoEmails.csv
├── Mongolia
│   ├── Mongolia.csv
│   └── MongoliaEmails.csv
├── Montenergo
│   ├── Montenegro.csv
│   └── MontenegroEmails.csv
├── Morocco
│   ├── Morocco.csv
│   └── MoroccoEmails.csv
├── Namibia
│   ├── Namibia.csv
│   └── NamibiaEmails.csv
├── Nauru
│   ├── Nauru.csv
│   └── NauruEmails.csv
├── Nepal
│   ├── Nepal.csv
│   └── NepalEmails.csv
├── Netherlands
│   ├── Netherlands Emails
│   │   └── NetherlandsEmails.csv
│   └── Netherlands Total
│       └── Netherlands.csv
├── Newzealand
│   ├── NewZealand.csv
│   └── NewZealandEmails.csv
├── Niger
│   ├── Niger Emails.csv
│   └── Niger Total.csv
├── Norway
│   ├── Norway.csv
│   └── NorwayEmails.csv
├── Oman
│   ├── Oman.csv
│   └── OmanEmails.csv
├── Pakistan
│   ├── Pakistan.csv
│   └── PakistanEmails.csv
├── Panama
│   ├── Panama.csv
│   └── PanamaEmails.csv
├── Paraguay
│   ├── Paraguay.csv
│   └── ParaguayEmails.csv
├── Peru
│   ├── Peru.csv
│   └── PeruEmails.csv
├── Philippines
│   ├── Philippines.csv
│   └── PhilippinesEmails.csv
├── Poland
│   ├── Polan total
│   │   └── Poland Total.csv
│   ├── Poland Emails
│   │   └── Poland Emails.csv
│   ├── Poland.csv
│   └── PolandEmails.csv
├── Qatar
│   ├── Qatar.csv
│   └── QatarEmails.csv
├── Romania
│   ├── Romania.csv
│   └── RomaniaEmails.csv
├── Russia
│   ├── Russia.csv
│   └── RussiaEmails.csv
├── Saintlucia
│   ├── SaintLucia.csv
│   └── SaintLuciaEmails.csv
├── Samoa
│   ├── Samoa.csv
│   └── SamoaEmails.csv
├── Sanmarino
│   ├── SanMarino.csv
│   └── SanMarinoEmails.csv
├── Serbia
│   ├── Serbia.csv
│   └── SerbiaEmails.csv
├── Seychelles
│   ├── Seychelles.csv
│   └── SeychellesEmails.csv
├── Slovakia
│   ├── Slovakia.csv
│   └── SlovakiaEmails.csv
├── Slovenia
│   ├── Slovenia.csv
│   └── SloveniaEmails.csv
├── South africa
│   ├── SouthAfrica.csv
│   └── southafricaemails.csv
├── South korea
│   ├── SouthKorea.csv
│   └── SouthKoreaEmails.csv
├── Spain
│   ├── Spain Emails
│   │   └── Spain Emails.csv
│   └── Spain Total
│       └── Spain Total.csv
├── Srilanka
│   ├── SriLanka.csv
│   └── SriLankaEmails.csv
├── Suriname
│   ├── Suriname.csv
│   └── SurinameEmails.csv
├── Sweden
│   ├── Sweden.csv
│   └── SwedenEmails.csv
├── Switzerland
│   ├── Switzerland Total.csv
│   └── SwitzerlandEmails.csv
├── Syria
│   ├── Syria.csv
│   └── SyriaEmails.csv
├── Taiwan
│   ├── Taiwan Emails.csv
│   └── Taiwan Total.csv
├── Tajikistan
│   ├── Tajikistan.csv
│   └── TajikistanEmails.csv
├── Thailand
│   ├── Thailand.csv
│   └── ThailandEmails.csv
├── Tonga
│   ├── Tonga.csv
│   └── TongaEmails.csv
├── Tunisia
│   ├── Tunisia.csv
│   └── TunisiaEmails.csv
├── Turkey
│   ├── Turkey.csv
│   └── turkeyemails.csv
├── Turkmenistan
│   ├── Turkmenistan.csv
│   └── TurkmenistanEmails.csv
├── Uganda
│   ├── Uganda.csv
│   └── UgandaEmails.csv
├── Ukraine
│   ├── Ukraine.csv
│   └── ukraineEmails.csv
├── United Arab Emirates
│   ├── UnitedArabEmirates.csv
│   └── UnitedArabEmiratesemails.csv
├── Vietname
│   ├── Vietnam.csv
│   └── Vietnamemails.csv
└── Zambia
    ├── Zambia.csv
    └── zambiaemails.csv

160 directories, 245 files
```

---

## 파일 유형

| 유형 | 설명 | 예시 |
|------|------|------|
| `[Country].csv` | 전체 리드 | `Albania.csv` |
| `[Country]Emails.csv` | 이메일 있는 리드만 | `albaniaEmails.csv` |
| `[Country] Total/` | 대용량 국가 전체 리드 폴더 | `USA Total/` |
| `[Country] Emails/` | 대용량 국가 이메일 리드 폴더 | `USA Emails/` |

---

## 대용량 국가 (별도 폴더)

| 국가 | Total 폴더 | Emails 폴더 |
|------|-----------|-------------|
| United States | ✅ | ✅ |
| United Kingdom | ✅ | ✅ |
| Canada | ✅ | ✅ |
| Australia | ✅ | ✅ |
| India | ✅ | ✅ |
| Brazil | ✅ | ✅ |
| France | ✅ | ✅ |
| Mexico | ✅ | ✅ |
| Italy | ✅ | ✅ |
| Spain | ✅ | ✅ |
| Indonesia | ✅ | ✅ |
| Netherlands | ✅ | ✅ |
| China | ✅ | ✅ |
| Colombia | ✅ | ✅ |
| Argentina | ✅ | ✅ |
| Belgium | ✅ | ✅ |
| Denmark | ✅ | ✅ |
| Egypt | ✅ | ✅ |
| Poland | ✅ | ✅ |

---

*생성일: 2025-12-30*
