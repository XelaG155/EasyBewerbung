"use client";

import Link from "next/link";
import { useState } from "react";

const translations = {
  en: {
    label: "English",
    heroTitle: "Epic applications in your language.",
    heroSubtitle:
      "Clear, respectful guidance for cleaning, production, hospitality, and factory roles.",
    supportLine:
      "Straightforward steps that keep you confident — no jargon, just strong stories that land interviews.",
    ctaPrimary: "Start your story",
    ctaSecondary: "See the power-up kit",
    ticker: [
      "Cleaning shifts ready",
      "Factory forms simplified",
      "Logistics CV boosts",
      "Hospitality-friendly notes",
      "Recruiter signals online",
    ],
    roleLine: "Cleaning • Factory • Logistics",
  },
  de: {
    label: "Deutsch",
    heroTitle: "Epische Bewerbungen in deiner Sprache.",
    heroSubtitle:
      "Klare Anleitung für Jobs in Reinigung, Produktion, Logistik und Fabrikarbeit.",
    supportLine:
      "Einfache Schritte ohne Fachjargon – damit jede Bewerbung stark und respektvoll klingt.",
    ctaPrimary: "Leg jetzt los",
    ctaSecondary: "Power-up ansehen",
    ticker: [
      "Reinigungsschichten bereit",
      "Fabrikformulare vereinfacht",
      "Logistik-CV gestärkt",
      "Gastgewerbe-Notizen",
      "Recruiter-Signale aktiv",
    ],
    roleLine: "Reinigung • Fabrik • Logistik",
  },
  fr: {
    label: "Français",
    heroTitle: "Des candidatures épiques, dans votre langue.",
    heroSubtitle:
      "Conseils clairs pour des postes de nettoyage, d'usine, de logistique et d'hôtellerie.",
    supportLine:
      "Un langage simple et respectueux pour décrocher des entretiens, sans jargon inutile.",
    ctaPrimary: "Lancer mon dossier",
    ctaSecondary: "Découvrir les atouts",
    ticker: [
      "Missions de nettoyage prêtes",
      "Formulaires d'usine simplifiés",
      "CV logistique renforcé",
      "Notes pour l'hôtellerie",
      "Signaux recruteurs en ligne",
    ],
    roleLine: "Nettoyage • Usine • Logistique",
  },
  es: {
    label: "Español",
    heroTitle: "Solicitudes épicas en tu idioma.",
    heroSubtitle:
      "Guía clara para trabajos de limpieza, fábrica, logística y hospitalidad.",
    supportLine:
      "Pasos sencillos y respetuosos: sin jerga, solo historias fuertes para entrevistas.",
    ctaPrimary: "Comenzar",
    ctaSecondary: "Ver el kit",
    ticker: [
      "Turnos de limpieza listos",
      "Formularios de fábrica simples",
      "CV logístico reforzado",
      "Notas para hospitalidad",
      "Señales de reclutadores",
    ],
    roleLine: "Limpieza • Fábrica • Logística",
  },
  pt: {
    label: "Português",
    heroTitle: "Candidaturas épicas no seu idioma.",
    heroSubtitle:
      "Orientação clara para vagas de limpeza, fábrica, logística e hotelaria.",
    supportLine:
      "Passos diretos e respeitosos — sem jargão, só histórias fortes para entrevistas.",
    ctaPrimary: "Começar agora",
    ctaSecondary: "Ver o kit",
    ticker: [
      "Turnos de limpeza prontos",
      "Formulários de fábrica simples",
      "CV de logística reforçado",
      "Notas para hotelaria",
      "Sinais de recrutadores",
    ],
    roleLine: "Limpeza • Fábrica • Logística",
  },
  sq: {
    label: "Shqip",
    heroTitle: "Aplikime epike në gjuhën tuaj.",
    heroSubtitle:
      "Udhëzim i qartë për punë pastrimi, fabrike, logjistike dhe mikpritjeje.",
    supportLine:
      "Hapa të thjeshtë e me respekt – pa zhargon, vetëm histori që të çojnë në intervistë.",
    ctaPrimary: "Fillo tani",
    ctaSecondary: "Shiko paketën",
    ticker: [
      "Turne pastrimi gati",
      "Formularë fabrike të thjeshtë",
      "CV logjistike e forcuar",
      "Shënime mikpritjeje",
      "Sinjale nga rekrutuesit",
    ],
    roleLine: "Pastrimi • Fabrika • Logjistika",
  },
  hr: {
    label: "Hrvatski",
    heroTitle: "Epske prijave na vašem jeziku.",
    heroSubtitle:
      "Jasne upute za poslove čišćenja, tvornice, logistike i ugostiteljstva.",
    supportLine:
      "Jednostavni, poštovani koraci – bez žargona, samo snažne priče za razgovore.",
    ctaPrimary: "Kreni sada",
    ctaSecondary: "Pogledaj mogućnosti",
    ticker: [
      "Smjene čišćenja spremne",
      "Tvornicki obrasci jednostavni",
      "Logistički životopis ojačan",
      "Bilješke za ugostiteljstvo",
      "Signali regrutera uživo",
    ],
    roleLine: "Čišćenje • Tvornica • Logistika",
  },
  sr: {
    label: "Српски",
    heroTitle: "Епске пријаве на вашем језику.",
    heroSubtitle:
      "Јасна упутства за послове чишћења, фабрике, логистике и угоститељства.",
    supportLine:
      "Просте и поштоване кораке без жаргона — само снажне приче за интервјуе.",
    ctaPrimary: "Почни сада",
    ctaSecondary: "Погледај опрему",
    ticker: [
      "Смене за чишћење спремне",
      "Фабрички обрасци једноставни",
      "Логистички CV појачан",
      "Белешке за угоститељство",
      "Сигнали рекрутера уживо",
    ],
    roleLine: "Чишћење • Фабрика • Логистика",
  },
  ru: {
    label: "Русский",
    heroTitle: "Яркие заявки на вашем языке.",
    heroSubtitle:
      "Понятные шаги для работы в клининге, на заводе, в логистике и сфере услуг.",
    supportLine:
      "Без сложного жаргона — только уважительные и сильные истории для собеседований.",
    ctaPrimary: "Начать",
    ctaSecondary: "Посмотреть возможности",
    ticker: [
      "Смены по уборке готовы",
      "Фабричные формы упрощены",
      "Усиленное резюме для логистики",
      "Заметки для сервиса",
      "Сигналы рекрутеров онлайн",
    ],
    roleLine: "Уборка • Завод • Логистика",
  },
  uk: {
    label: "Українська",
    heroTitle: "Яскраві заявки вашою мовою.",
    heroSubtitle:
      "Чіткі кроки для роботи з прибирання, на заводі, у логістиці та готелях.",
    supportLine:
      "Жодного жаргону — тільки повага й сильні історії, що ведуть на співбесіду.",
    ctaPrimary: "Почати",
    ctaSecondary: "Подивитися можливості",
    ticker: [
      "Зміни з прибирання готові",
      "Фабричні форми спрощені",
      "Логістичне резюме посилено",
      "Нотатки для сервісу",
      "Сигнали рекрутерів онлайн",
    ],
    roleLine: "Прибирання • Завод • Логістика",
  },
  bg: {
    label: "Български",
    heroTitle: "Епични кандидатури на вашия език.",
    heroSubtitle:
      "Ясни стъпки за работа в почистване, фабрика, логистика и хотелиерство.",
    supportLine:
      "Без жаргон – само уважителни думи и силни истории за интервю.",
    ctaPrimary: "Старт",
    ctaSecondary: "Виж функциите",
    ticker: [
      "Смени за почистване готови",
      "Фабрични формуляри опростени",
      "Укрепено CV за логистика",
      "Бележки за услуги",
      "Сигнали от рекрутери",
    ],
    roleLine: "Почистване • Фабрика • Логистика",
  },
  ro: {
    label: "Română",
    heroTitle: "Candidaturi epice în limba ta.",
    heroSubtitle:
      "Ghid clar pentru joburi de curățenie, fabrică, logistică și ospitalitate.",
    supportLine:
      "Pași simpli și respectuoși – fără jargon, doar povești puternice pentru interviuri.",
    ctaPrimary: "Începe acum",
    ctaSecondary: "Vezi kitul",
    ticker: [
      "Schimburi de curățenie gata",
      "Formulare de fabrică simple",
      "CV logistic întărit",
      "Note pentru ospitalitate",
      "Semnale de la recrutori",
    ],
    roleLine: "Curățenie • Fabrică • Logistică",
  },
  it: {
    label: "Italiano (CH)",
    heroTitle: "Candidature epiche nella tua lingua.",
    heroSubtitle:
      "Guida chiara per lavori di pulizia, fabbrica, logistica e ospitalità in Svizzera.",
    supportLine:
      "Istruzioni semplici e rispettose: niente gergo, solo storie convincenti.",
    ctaPrimary: "Inizia ora",
    ctaSecondary: "Vedi il kit",
    ticker: [
      "Turni di pulizia pronti",
      "Moduli di fabbrica semplici",
      "CV logistica potenziato",
      "Note per ospitalità",
      "Segnali dei recruiter",
    ],
    roleLine: "Pulizia • Fabbrica • Logistica",
  },
  rm: {
    label: "Rumantsch",
    heroTitle: "Annunzis epics en tia lingua.",
    heroSubtitle:
      "Guidanza clera per lavurs da nettegiar, fabrica, logistica e hotellaria.",
    supportLine:
      "Pass da simpls cun resguard – senza girgion, mo istorias fermas per entrevistas.",
    ctaPrimary: "Cumenzar",
    ctaSecondary: "Vesair il kit",
    ticker: [
      "Turnus da nettegiar pronts",
      "Formulars da fabrica simplifitgads",
      "CV da logistica rinforzà",
      "Notizias per hotellaria",
      "Signals da recruters",
    ],
    roleLine: "Nettegiar • Fabrica • Logistica",
  },
  ar: {
    label: "العربية",
    heroTitle: "طلبات عمل ملحمية بلغتك.",
    heroSubtitle:
      "إرشادات واضحة لوظائف التنظيف والمصانع واللوجستيات والضيافة.",
    supportLine:
      "خطوات بسيطة ومحترمة بلا مصطلحات معقدة، لتصل إلى المقابلات بثقة.",
    ctaPrimary: "ابدأ الآن",
    ctaSecondary: "استكشف المجموعة",
    ticker: [
      "نوبات تنظيف جاهزة",
      "نماذج مصانع مبسطة",
      "تعزيز السيرة اللوجستية",
      "ملاحظات للضيافة",
      "إشارات التوظيف متصلة",
    ],
    roleLine: "تنظيف • مصنع • لوجستيات",
  },
  am: {
    label: "አማርኛ",
    heroTitle: "ስራ ጥያቄዎች በቋንቋዎ በአስገራሚ ሁኔታ.",
    heroSubtitle:
      "ለንጽህና፣ ፋብሪካ፣ ሎጂስቲክስ እና እንግዳ አቀባበል ስራዎች ግልጽ መመሪያ.",
    supportLine:
      "ያልተወሰነ ጃርጎን የሌለው ቀላል እና አክብሮት ያለው መንገድ።",
    ctaPrimary: "ይጀምሩ",
    ctaSecondary: "መሣሪያውን ይመልከቱ",
    ticker: [
      "የንጽህና ቀጠሮዎች ዝግጁ",
      "የፋብሪካ ቅጾች ቀለል ያሉ",
      "የሎጂስቲክስ ሲቪ ታጠናክሮ",
      "ለእንግዳ አቀባበል ማስታወሻዎች",
      "የቀጥታ ምልክቶች ከአማልክቶች",
    ],
    roleLine: "ንጽህና • ፋብሪካ • ሎጂስቲክስ",
  },
  ti: {
    label: "ትግርኛ",
    heroTitle: "በቋንቋኻ ኣስገራሚ የስራ ምልክታት.",
    heroSubtitle:
      "ንስራታት ንጽህና፣ ፋብሪካ፣ ሎጂስቲክስን እና እንግዳ አቀባበልን ግልጽ መመሪያ።",
    supportLine:
      "ዘይተዋህቦ ጃርጎን ብምትሓልፍ ቀሊል እና ክቡር ኣስተዳደር።",
    ctaPrimary: "ጀምር",
    ctaSecondary: "ኣብ መሣርሒ ርኢ",
    ticker: [
      "ግዜ ንጽህና ዝዘጋጀ",
      "ቀሊል ዝሓለፉ ቅጣቶም ፋብሪካ",
      "ሎጂስቲክስ ሲቪ ታሕጾ",
      "ማስታወሻታት እንግዳ አቀባበል",
      "ምልክት ካብ ኣመልካት ብትሕትና",
    ],
    roleLine: "ንጽህና • ፋብሪካ • ሎጂስቲክስ",
  },
  so: {
    label: "Soomaali",
    heroTitle: "Codsiyo cajiib ah oo ku qoran afkaaga.",
    heroSubtitle:
      "Tilmaan cad oo loogu talagalay shaqooyinka nadaafadda, warshadda, saadka iyo adeegga.",
    supportLine:
      "Tallaabooyin fudud oo ixtiraam leh — lagama maarmaan ma aha ereyo adag.",
    ctaPrimary: "Billow hada",
    ctaSecondary: "Eeg qalabka",
    ticker: [
      "Shaqooyinka nadaafadda diyaar",
      "Foomamka warshadda fudud",
      "CV saadka oo la xoojiyay",
      "Qoraallo adeeg",
      "Calaamadaha shaqaaleynta toos",
    ],
    roleLine: "Nadaafad • Warshad • Saadka",
  },
  sw: {
    label: "Kiswahili",
    heroTitle: "Maombi ya kazi ya kishujaa kwa lugha yako.",
    heroSubtitle:
      "Mwongozo wazi kwa kazi za usafi, kiwandani, usafirishaji na wageni.",
    supportLine:
      "Hatua rahisi na zenye heshima—bila maneno magumu, tu hadithi imara za mahojiano.",
    ctaPrimary: "Anza sasa",
    ctaSecondary: "Angalia kifurushi",
    ticker: [
      "Zamu za usafi tayari",
      "Fomu za kiwanda rahisi",
      "CV ya usafirishaji imeboreshwa",
      "Vidokezo vya huduma",
      "Ishara za waajiri hewani",
    ],
    roleLine: "Usafi • Kiwanda • Usafirishaji",
  },
  yo: {
    label: "Yorùbá",
    heroTitle: "Ìbéèrè iṣẹ́ àgbàyanu ní èdè rẹ.",
    heroSubtitle:
      "Ìtọ́sọ́nà kedere fún iṣẹ́ ìmótótó, fáìfíríkà, ẹ̀ka ẹru àti ìrísí alejo.",
    supportLine:
      "Ìgbésẹ̀ rọrùn tí ó ní ìyì – kò sí gírágán, ìtàn alágbára fún àjọyọ̀.",
    ctaPrimary: "Bẹrẹ báyìí",
    ctaSecondary: "Wo irinṣẹ́",
    ticker: [
      "Àkókò ìmótótó ṣetán",
      "Fọọmu fáìfíríkà rọrùn",
      "CV ẹ̀ka ẹru tó lágbára",
      "Àkọsílẹ̀ ìtẹ́lọ́rùn",
      "Àmì olùyànjú lórí ayélujára",
    ],
    roleLine: "Ìmótótó • Fáìfíríkà • Ẹ̀ka ẹru",
  },
  zu: {
    label: "isiZulu",
    heroTitle: "Izicelo eziyizingwazi ngolimi lwakho.",
    heroSubtitle:
      "Imiyalelo ecacile yemisebenzi yokuhlanza, efekthri, yezimpahla nezokuvakasha.",
    supportLine:
      "Izinyathelo ezilula nezihloniphekile — akukho mkhuba, izindaba eziqinile zezingxoxo.",
    ctaPrimary: "Qala manje",
    ctaSecondary: "Bheka amathuluzi",
    ticker: [
      "Amashifu okuhlanza alungele",
      "Amafomu efekthri alula",
      "I-CV yezimpahla eqinisiwe",
      "Amanothi wezokuvakasha",
      "Izimpawu zabaqashi ku-inthanethi",
    ],
    roleLine: "Ukuhlanza • Ifekthri • Ezimpahla",
  },
  fil: {
    label: "Filipino",
    heroTitle: "Mga aplikasyon na kahanga-hanga sa sariling wika.",
    heroSubtitle:
      "Malinaw na gabay para sa trabahong paglilinis, pabrika, logistika at hospitality.",
    supportLine:
      "Magaang at magalang na hakbang — walang jargon, puro matitibay na kuwento.",
    ctaPrimary: "Simulan",
    ctaSecondary: "Tingnan ang kit",
    ticker: [
      "Handa na ang mga shift sa paglilinis",
      "Simpleng porma ng pabrika",
      "Pinalakas na CV para sa logistika",
      "Mga tala para sa hospitality",
      "Mga signal ng recruiter online",
    ],
    roleLine: "Paglilinis • Pabrika • Logistika",
  },
  th: {
    label: "ไทย",
    heroTitle: "ใบสมัครงานสุดยิ่งใหญ่ในภาษาของคุณ.",
    heroSubtitle:
      "คำแนะนำชัดเจนสำหรับงานทำความสะอาด โรงงาน โลจิสติกส์ และงานบริการ.",
    supportLine:
      "ขั้นตอนง่าย ๆ และให้เกียรติ ไม่มีศัพท์ยาก เพื่อให้ถึงการสัมภาษณ์อย่างมั่นใจ.",
    ctaPrimary: "เริ่มเลย",
    ctaSecondary: "ดูอุปกรณ์",
    ticker: [
      "กะทำความสะอาดพร้อม",
      "แบบฟอร์มโรงงานเรียบง่าย",
      "เสริม CV ด้านโลจิสติกส์",
      "บันทึกงานบริการ",
      "สัญญาณผู้สรรหาออนไลน์",
    ],
    roleLine: "ทำความสะอาด • โรงงาน • โลจิสติกส์",
  },
  zh: {
    label: "中文",
    heroTitle: "用你的语言完成震撼的求职申请。",
    heroSubtitle:
      "为清洁、工厂、物流和服务岗位提供清晰指引。",
    supportLine:
      "没有复杂术语，尊重且直接的步骤，帮助你拿到面试。",
    ctaPrimary: "立即开始",
    ctaSecondary: "查看功能",
    ticker: [
      "清洁班次就绪",
      "工厂表格简化",
      "物流简历强化",
      "服务业提示",
      "招聘信号在线",
    ],
    roleLine: "清洁 • 工厂 • 物流",
  },
  hi: {
    label: "हिन्दी",
    heroTitle: "आपकी भाषा में दमदार नौकरी आवेदन।",
    heroSubtitle:
      "सफाई, फ़ैक्ट्री, लॉजिस्टिक्स और आतिथ्य नौकरियों के लिए स्पष्ट मार्गदर्शन।",
    supportLine:
      "सरल और सम्मानजनक कदम, बिना मुश्किल शब्दों के, सीधे इंटरव्यू तक पहुँचाने वाले।",
    ctaPrimary: "शुरू करें",
    ctaSecondary: "किट देखें",
    ticker: [
      "सफाई की शिफ्ट तैयार",
      "फ़ैक्ट्री फ़ॉर्म सरल",
      "लॉजिस्टिक्स CV मजबूत",
      "आतिथ्य नोट्स",
      "भर्तीकर्ता संकेत ऑनलाइन",
    ],
    roleLine: "सफाई • फ़ैक्ट्री • लॉजिस्टिक्स",
  },
  tr: {
    label: "Türkçe",
    heroTitle: "Kendi dilinizde epik başvurular.",
    heroSubtitle:
      "Temizlik, fabrika, lojistik ve otel işleri için net rehberlik.",
    supportLine:
      "Jargonsuz, saygılı ve net adımlar; sizi doğrudan mülakata taşır.",
    ctaPrimary: "Hemen başla",
    ctaSecondary: "Kiti gör",
    ticker: [
      "Temizlik vardiyaları hazır",
      "Fabrika formları basit",
      "Lojistik CV güçlendirildi",
      "Misafirperverlik notları",
      "İşe alım sinyalleri çevrimiçi",
    ],
    roleLine: "Temizlik • Fabrika • Lojistik",
  },
  ja: {
    label: "日本語",
    heroTitle: "あなたの言語で壮大な応募を。",
    heroSubtitle:
      "清掃、工場、物流、接客の仕事に向けたわかりやすいガイド。",
    supportLine:
      "専門用語なしの丁寧なステップで、自信を持って面接へ。",
    ctaPrimary: "今すぐ始める",
    ctaSecondary: "機能を見る",
    ticker: [
      "清掃シフト準備完了",
      "工場フォームを簡略化",
      "物流履歴書を強化",
      "接客向けメモ",
      "採用シグナルオンライン",
    ],
    roleLine: "清掃 • 工場 • 物流",
  },
  ko: {
    label: "한국어",
    heroTitle: "당신의 언어로 만드는 서사적인 지원서.",
    heroSubtitle:
      "청소, 공장, 물류, 서비스 직업을 위한 명확한 안내.",
    supportLine:
      "어려운 용어 없이 정중하고 간단한 단계로 면접을 준비하세요.",
    ctaPrimary: "지금 시작",
    ctaSecondary: "기능 보기",
    ticker: [
      "청소 근무 준비 완료",
      "공장 서류 간소화",
      "물류 이력서 강화",
      "서비스 노트",
      "채용 신호 온라인",
    ],
    roleLine: "청소 • 공장 • 물류",
  },
  ha: {
    label: "Hausa",
    heroTitle: "Aikace-aikacen aiki masu ƙarfi a harshenka.",
    heroSubtitle:
      "Jagora mai sauƙi ga ayyukan tsabtace muhalli, masana'antu, sufuri da hidima.",
    supportLine:
      "Matakai masu girmamawa ba tare da hayaniya ba — labarai masu ƙarfi don samun hira.",
    ctaPrimary: "Fara yanzu",
    ctaSecondary: "Duba kayan aiki",
    ticker: [
      "Lokutan tsaftacewa sun shirya",
      "Takardun masana'anta sun sauƙaƙa",
      "An ƙarfafa CV na sufuri",
      "Bayanan hidima",
      "Alamomin ɗaukar ma'aikata kan layi",
    ],
    roleLine: "Tsaftacewa • Masana'anta • Sufuri",
  },
  ig: {
    label: "Igbo",
    heroTitle: "Nkwupụta ọrụ dị egwu n'asụsụ gị.",
    heroSubtitle:
      "Ndụmọdụ doro anya maka ọrụ nhicha, ụlọ ọrụ, mbufe na ọrụ ndị ọbịa.",
    supportLine:
      "Nzọụkwụ dị mfe na nke nwere nsọpụrụ — enweghị okwu mgbagwoju anya, naanị akụkọ siri ike maka ajụjụ ọnụ.",
    ctaPrimary: "Malite ugbu a",
    ctaSecondary: "Lee ngwugwu",
    ticker: [
      "Mgbanwe nhicha dị njikere",
      "Fọm ụlọ ọrụ dị mfe",
      "E kwadoro CV mbufe",
      "Akwụkwọ maka ọrụ ndị ọbịa",
      "Ihe ngosi ndị na-ewepụta ndị ọrụ n'ịntanetị",
    ],
    roleLine: "Nhicha • Ụlọ ọrụ • Mbufe",
  },
  rw: {
    label: "Kinyarwanda",
    heroTitle: "Gusaba akazi gakomeye mu rurimi rwawe.",
    heroSubtitle:
      "Amabwiriza asobanutse ku mirimo yo gusukura, uruganda, ubwikorezi n'ubugiraneza.",
    supportLine:
      "Intambwe zoroshye kandi zujuje ikinyabupfura — nta magambo akomeye, ahubwo inkuru zikomeye zo kugera ku biganiro.",
    ctaPrimary: "Tangira nonaha",
    ctaSecondary: "Reba ibikoresho",
    ticker: [
      "Isaha zo gusukura ziteguye",
      "Impapuro z'uruganda zoroherejwe",
      "CV y'ubwikorezi yongerewe imbaraga",
      "Ibisobanuro by'ubugiraneza",
      "Ibimenyetso by'abashaka abakozi kuri interineti",
    ],
    roleLine: "Isuku • Uruganda • Ubwikorezi",
  },
  om: {
    label: "Afaan Oromo",
    heroTitle: "Hojii gabaa cimaa afaan keessan irratti.",
    heroSubtitle:
      "Qajeelfama ifaa hojjettoota qulqullinaa, warshaa, loojistikii fi tajaajilaaaf.",
    supportLine:
      "Tartiiba salphaa fi kabajaa – jechoota ulfaataa hin qabu, afuura wawwaataa gara wawwaaminsaatti geessu.",
    ctaPrimary: "Amma jalqabi",
    ctaSecondary: "Meeshaalee ilaali",
    ticker: [
      "Sa'aatii qulqullinaa qophaa'e",
      "Foormii warshaa salpha'e",
      "CV loojistikii jabeesse",
      "Yaadannoowwan tajaajilaa",
      "Mallattoo hojii fudhataa online",
    ],
    roleLine: "Qulqullinaa • Warshaa • Loojiistikii",
  },
  fa: {
    label: "فارسی",
    heroTitle: "درخواست‌های شغلی حماسی به زبان شما.",
    heroSubtitle:
      "راهنمایی شفاف برای کارهای نظافت، کارخانه، لجستیک و خدمات.",
    supportLine:
      "گام‌های ساده و محترمانه بدون اصطلاحات پیچیده تا به مصاحبه برسید.",
    ctaPrimary: "شروع کنید",
    ctaSecondary: "بسته را ببینید",
    ticker: [
      "شیفت‌های نظافت آماده است",
      "فرم‌های کارخانه ساده شد",
      "رزومه لجستیک تقویت شد",
      "یادداشت‌های خدمات",
      "سیگنال‌های استخدام آنلاین",
    ],
    roleLine: "نظافت • کارخانه • لجستیک",
  },
  ur: {
    label: "اردو",
    heroTitle: "آپ کی زبان میں شاندار ملازمت کی درخواستیں۔",
    heroSubtitle:
      "صفائی، فیکٹری، لاجسٹکس اور مہمان نوازی کی ملازمتوں کیلئے واضح رہنمائی۔",
    supportLine:
      "سادہ اور باعزت اقدامات، بغیر مشکل اصطلاحات کے، جو آپ کو انٹرویو تک لے جائیں۔",
    ctaPrimary: "ابھی شروع کریں",
    ctaSecondary: "کِٹ دیکھیں",
    ticker: [
      "صفائی کی شفٹیں تیار",
      "فیکٹری فارم آسان",
      "لاجسٹکس سی وی مضبوط",
      "مہمان نوازی نوٹس",
      "آن لائن بھرتی سگنلز",
    ],
    roleLine: "صفائی • فیکٹری • لاجسٹکس",
  },
  bn: {
    label: "বাংলা",
    heroTitle: "আপনার ভাষায় দারুণ চাকরির আবেদন।",
    heroSubtitle:
      "পরিষ্কার, কারখানা, লজিস্টিকস ও হসপিটালিটির কাজের জন্য পরিষ্কার নির্দেশনা।",
    supportLine:
      "সহজ ও সম্মানজনক ধাপ — কোনো কঠিন শব্দ নয়, শুধু শক্ত গল্প যেগুলো সাক্ষাৎকারে পৌঁছে দেয়।",
    ctaPrimary: "এখনই শুরু করুন",
    ctaSecondary: "কিট দেখুন",
    ticker: [
      "পরিষ্কার শিফট প্রস্তুত",
      "কারখানার ফর্ম সহজ",
      "লজিস্টিকস সিভি শক্তিশালী",
      "হসপিটালিটি নোট",
      "অনলাইন নিয়োগ সংকেত",
    ],
    roleLine: "পরিষ্কার • কারখানা • লজিস্টিকস",
  },
  vi: {
    label: "Tiếng Việt",
    heroTitle: "Hồ sơ ứng tuyển ấn tượng bằng ngôn ngữ của bạn.",
    heroSubtitle:
      "Hướng dẫn rõ ràng cho công việc vệ sinh, nhà máy, logistics và dịch vụ.",
    supportLine:
      "Các bước đơn giản, tôn trọng — không có thuật ngữ khó, chỉ là câu chuyện mạnh mẽ đưa bạn tới phỏng vấn.",
    ctaPrimary: "Bắt đầu ngay",
    ctaSecondary: "Xem bộ công cụ",
    ticker: [
      "Ca vệ sinh sẵn sàng",
      "Biểu mẫu nhà máy gọn",
      "CV logistics được tăng cường",
      "Ghi chú dịch vụ",
      "Tín hiệu tuyển dụng trực tuyến",
    ],
    roleLine: "Vệ sinh • Nhà máy • Logistics",
  },
  id: {
    label: "Bahasa Indonesia",
    heroTitle: "Lamaran kerja epik dalam bahasa Anda.",
    heroSubtitle:
      "Panduan jelas untuk pekerjaan kebersihan, pabrik, logistik, dan layanan.",
    supportLine:
      "Langkah sederhana dan sopan — tanpa jargon rumit, hanya cerita kuat untuk wawancara.",
    ctaPrimary: "Mulai sekarang",
    ctaSecondary: "Lihat paket",
    ticker: [
      "Shift kebersihan siap",
      "Formulir pabrik sederhana",
      "CV logistik diperkuat",
      "Catatan layanan",
      "Sinyal rekrutmen daring",
    ],
    roleLine: "Kebersihan • Pabrik • Logistik",
  },
} as const;

const features = [
  {
    title: "Story-driven applications",
    description:
      "Turn every upload into a cinematic dossier with context, mood, and tailored cover notes.",
  },
  {
    title: "Talent intelligence",
    description:
      "Smart summaries extract role-ready talking points so you enter interviews battle-prepared.",
  },
  {
    title: "Signal-boosted delivery",
    description:
      "Beautiful, on-brand PDF exports, tracking, and reminders keep your profile front and center.",
  },
];

const stages = [
  {
    label: "01",
    title: "Summon your dossier",
    detail: "Drop your CV and references — we forge a cohesive candidate profile in seconds.",
  },
  {
    label: "02",
    title: "Craft the legend",
    detail: "Pick a role and tone. The narrative engine drafts bespoke cover letters and talking points.",
  },
  {
    label: "03",
    title: "Launch the signal",
    detail: "Export polished packets, share with recruiters, and track engagement like mission control.",
  },
];

const stats = [
  { label: "Applications accelerated", value: "3.2x" },
  { label: "Interview callbacks", value: "+68%" },
  { label: "Recruiter wow factor", value: "9.5/10" },
];

const experiences = [
  {
    title: "Immersive dashboard",
    description:
      "Watch every document, status, and reminder glow in a cinematic cockpit built for momentum.",
  },
  {
    title: "Real-time curation",
    description:
      "Fine-tune wording, highlights, and tone on the fly with instant previews and versioning.",
  },
  {
    title: "Victory wall",
    description:
      "Celebrate offers, track outreach, and keep winning streaks alive with gamified milestones.",
  },
];

function Aurora() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-36 -top-24 h-80 w-80 rounded-full bg-indigo-500/30 blur-3xl" />
      <div className="absolute left-1/2 top-10 h-96 w-96 -translate-x-1/2 rounded-full bg-fuchsia-500/20 blur-3xl" />
      <div className="absolute -right-24 top-24 h-72 w-72 rounded-full bg-cyan-400/25 blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.05),_transparent_40%)]" />
    </div>
  );
}

function GlowCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-indigo-500/10 backdrop-blur">
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-white/5 to-transparent opacity-60" />
      <div className="relative">{children}</div>
    </div>
  );
}

function Sparkle({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v4" />
      <path d="M12 17v4" />
      <path d="m4.93 4.93 2.83 2.83" />
      <path d="m16.24 16.24 2.83 2.83" />
      <path d="M3 12h4" />
      <path d="M17 12h4" />
      <path d="m4.93 19.07 2.83-2.83" />
      <path d="m16.24 7.76 2.83-2.83" />
    </svg>
  );
}

function Flame({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22c-4.97 0-8-3.03-8-7 0-2.82 1.64-5.23 3.97-6.41a.49.49 0 0 1 .72.46c-.13 1.63.37 2.95 1.35 3.94.62.62 1.6.13 1.8-.74.29-1.23.61-2.9-.29-4.72-.23-.47.22-.98.7-.76 2.7 1.22 5.05 4.13 5.05 7.9 0 3.34-2.69 6.33-6.3 6.33Z" />
    </svg>
  );
}

export default function Home() {
  const [language, setLanguage] = useState<keyof typeof translations>("en");
  const current = translations[language];

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <Aurora />
      <header className="relative z-10 mx-auto flex max-w-6xl flex-col gap-6 px-6 pb-8 pt-10 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3 text-lg font-semibold">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 ring-2 ring-white/10">
            <Flame className="h-6 w-6 text-fuchsia-200" />
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-slate-300">EasyBewerbung</p>
            <p className="text-base font-semibold text-white">Epic Application Forge</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-4 py-2 text-emerald-100">
            {current.roleLine}
          </span>
          <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-fuchsia-100">
            <Sparkle className="h-4 w-4" />
            Multilingual
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex max-w-6xl flex-col gap-16 px-6 pb-20">
        <section className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-fuchsia-100">
              <Sparkle className="h-4 w-4" />
              Unleash your application saga
            </div>
            <div className="space-y-4">
              <h1 className="text-4xl font-black leading-tight text-white md:text-5xl lg:text-6xl">
                {current.heroTitle} <span className="text-transparent bg-gradient-to-r from-fuchsia-300 via-sky-200 to-indigo-300 bg-clip-text">for every worker.</span>
              </h1>
              <p className="text-lg text-slate-200/90 md:text-xl">{current.heroSubtitle}</p>
              <p className="text-sm text-emerald-100/90">{current.supportLine}</p>
              <p className="text-xs text-cyan-100/80">
                Use the cockpit in your mother tongue, then generate full application documents in the hiring language you choose.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <Link
                href="#upload"
                className="rounded-full bg-gradient-to-r from-fuchsia-500 via-indigo-500 to-cyan-400 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-fuchsia-500/40 transition hover:scale-[1.02]"
              >
                {current.ctaPrimary}
              </Link>
              <Link
                href="#features"
                className="rounded-full border border-white/15 bg-white/5 px-6 py-3 text-base font-semibold text-white transition hover:border-white/40 hover:bg-white/10"
              >
                {current.ctaSecondary}
              </Link>
            </div>
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Choose your language</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(translations).map(([code, value]) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setLanguage(code as keyof typeof translations)}
                    className={`rounded-full border px-3 py-1 text-sm transition ${
                      language === code
                        ? "border-fuchsia-300 bg-fuchsia-500/20 text-white"
                        : "border-white/15 bg-white/5 text-slate-200 hover:border-white/40"
                    }`}
                  >
                    {value.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {stats.map((stat) => (
                <GlowCard key={stat.label}>
                  <p className="text-sm uppercase tracking-[0.2em] text-slate-300">{stat.label}</p>
                  <p className="text-3xl font-black text-white">{stat.value}</p>
                </GlowCard>
              ))}
            </div>
          </div>

          <div className="relative rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-indigo-500/20 backdrop-blur">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-white/10 to-transparent" />
            <div className="relative flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Mission feed</p>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                  Live
                </div>
              </div>
              <div className="flex gap-2 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60 p-3 shadow-inner">
                <div className="flex animate-[marquee_18s_linear_infinite] gap-2 whitespace-nowrap text-sm text-slate-200">
                  {current.ticker.map((item) => (
                    <span
                      key={item}
                      className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1"
                    >
                      <Sparkle className="h-4 w-4 text-cyan-200" />
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <div className="space-y-3 rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 p-4 shadow-inner">
                <p className="text-sm font-semibold text-slate-200">Upload timeline</p>
                <div className="space-y-3 text-sm text-slate-200/90">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 h-2.5 w-2.5 rounded-full bg-fuchsia-400" />
                    <div>
                      <p className="font-semibold text-white">CV_Ultraviolet.pdf</p>
                      <p>Refined summaries crafted for Product Lead roles.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="mt-1 h-2.5 w-2.5 rounded-full bg-cyan-400" />
                    <div>
                      <p className="font-semibold text-white">Portfolio_Spectra.zip</p>
                      <p>Auto-tagged achievements and spotlighted case studies.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    <div>
                      <p className="font-semibold text-white">References_Stellar.pdf</p>
                      <p>Signal-boosted endorsements prepared for sharing.</p>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between pt-2 text-xs text-slate-300">
                  <span>Aligned with Berlin & Remote roles</span>
                  <span>Auto-sync enabled</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="languages" className="space-y-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-300">
            <Sparkle className="h-4 w-4 text-emerald-200" />
            Multilingual solidarity
          </div>
          <p className="max-w-3xl text-sm text-slate-200/80">
            From French, German, English, Spanish, Portuguese, and Albanian to Croatian, Serbian, Russian, Ukrainian,
            Bulgarian, Romanian, Hausa, Igbo, Kinyarwanda, Oromo, Amharic, Tigrinya, Somali, Arabic, Bengali, Filipino,
            Thai, Vietnamese, Indonesian, Persian, Urdu, Swiss Italian, Romansh, and many more across Africa and Asia —
            every worker can get a clear path to cleaning, factory, and logistics jobs.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(translations).map(([code, value]) => (
              <GlowCard key={code}>
                <div className="flex items-center justify-between pb-2">
                  <p className="text-lg font-semibold text-white">{value.label}</p>
                  <span className="text-xs uppercase tracking-[0.2em] text-slate-400">{code}</span>
                </div>
                <p className="text-sm text-slate-200/90">{value.supportLine}</p>
                <p className="pt-2 text-xs text-emerald-200/80">{value.roleLine}</p>
              </GlowCard>
            ))}
          </div>
        </section>

        <section id="features" className="space-y-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-300">
            <Sparkle className="h-4 w-4 text-fuchsia-200" />
            Power-up kit
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {features.map((feature) => (
              <GlowCard key={feature.title}>
                <div className="flex items-center gap-3 pb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500/50 to-indigo-500/50 text-white">
                    <Flame className="h-5 w-5" />
                  </div>
                  <p className="text-lg font-semibold text-white">{feature.title}</p>
                </div>
                <p className="text-sm text-slate-200/90">{feature.description}</p>
              </GlowCard>
            ))}
          </div>
        </section>

        <section id="stages" className="space-y-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-300">
            <Sparkle className="h-4 w-4 text-cyan-200" />
            Epic progression
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {stages.map((stage) => (
              <GlowCard key={stage.title}>
                <div className="flex items-center justify-between pb-2">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">{stage.label}</p>
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/5 text-fuchsia-200 ring-1 ring-white/15">
                    <Sparkle className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-xl font-semibold text-white">{stage.title}</p>
                <p className="pt-2 text-sm text-slate-200/90">{stage.detail}</p>
              </GlowCard>
            ))}
          </div>
        </section>

        <section id="upload" className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-300">
              <Sparkle className="h-4 w-4 text-emerald-200" />
              Document reactor
            </div>
            <h2 className="text-3xl font-black text-white md:text-4xl">
              Upload. Ignite. Share.
            </h2>
            <p className="text-lg text-slate-200/90">
              Bring your PDFs, portfolios, and references — the reactor aligns everything with the role you want. Expect neon previews, curated highlights, and export-ready bundles.
            </p>
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-200">Auto-tagged achievements</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-200">Story-synced cover letters</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-200">Real-time previews</span>
            </div>
            <Link
              href="#experience"
              className="inline-flex items-center gap-2 rounded-full border border-emerald-400/60 bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-3 text-base font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:scale-[1.02]"
            >
              See live cockpit
              <span className="text-lg">→</span>
            </Link>
          </div>

          <div className="space-y-4">
            <GlowCard>
              <div className="flex items-center justify-between pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-white/5" />
                  <div>
                    <p className="text-sm text-slate-200">Uploading</p>
                    <p className="text-lg font-semibold text-white">Portfolio_Spectra.zip</p>
                  </div>
                </div>
                <span className="text-xs text-emerald-300">98% synced</span>
              </div>
              <div className="h-2 w-full rounded-full bg-white/10">
                <div className="h-full w-[98%] rounded-full bg-gradient-to-r from-fuchsia-500 via-indigo-500 to-cyan-400" />
              </div>
              <p className="pt-3 text-xs text-slate-200/80">
                Auto-highlighting achievements and matching them to Product Lead archetypes.
              </p>
            </GlowCard>

            <div className="grid gap-4 md:grid-cols-2">
              {experiences.map((item) => (
                <GlowCard key={item.title}>
                  <p className="text-lg font-semibold text-white">{item.title}</p>
                  <p className="pt-2 text-sm text-slate-200/90">{item.description}</p>
                </GlowCard>
              ))}
            </div>
          </div>
        </section>

        <section id="experience" className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-300">
            <Sparkle className="h-4 w-4 text-indigo-200" />
            Mission control
          </div>
          <GlowCard>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-3 lg:max-w-xl">
                <p className="text-2xl font-black text-white">Command the epic journey</p>
                <p className="text-base text-slate-200/90">
                  Monitor every application orbit with a cinematic dashboard: real-time recruiter signals, reminders, and export-ready packets that feel engineered by a blockbuster studio.
                </p>
                <div className="flex flex-wrap gap-3 text-xs text-slate-100">
                  <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">Live engagement radar</span>
                  <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">Status automations</span>
                  <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">Role-based templates</span>
                  <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">Shareable dossiers</span>
                </div>
              </div>
              <div className="grid w-full max-w-xl grid-cols-2 gap-4 text-sm">
                <div className="col-span-2 rounded-2xl border border-white/10 bg-slate-950/60 p-4 shadow-inner">
                  <div className="flex items-center justify-between pb-2 text-xs text-slate-200">
                    <span>Recruiter signals</span>
                    <span className="flex items-center gap-2 text-emerald-300">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" /> Online
                    </span>
                  </div>
                  <div className="space-y-2 text-slate-200/90">
                    <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                      <span>Berlin — Product Lead</span>
                      <span className="text-xs text-emerald-300">Opened 2m ago</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                      <span>Remote — Senior PM</span>
                      <span className="text-xs text-amber-300">Viewed 12m ago</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                      <span>Munich — Lead UX</span>
                      <span className="text-xs text-slate-200">Queued</span>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Momentum</p>
                  <p className="text-3xl font-black text-white">94%</p>
                  <p className="text-xs text-slate-200/80">Weekly target nearly complete.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Confidence</p>
                  <p className="text-3xl font-black text-white">Legendary</p>
                  <p className="text-xs text-slate-200/80">Your dossier keeps impressing.</p>
                </div>
              </div>
            </div>
          </GlowCard>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/10 bg-slate-950/80 py-8 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-slate-300 md:flex-row">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-fuchsia-200" />
            <span className="font-semibold text-white">EasyBewerbung</span>
            <span className="text-slate-400">— Build the legend.</span>
          </div>
          <div className="flex gap-4 text-xs uppercase tracking-[0.2em] text-slate-400">
            <Link href="#features" className="hover:text-white">
              Features
            </Link>
            <Link href="#stages" className="hover:text-white">
              Progression
            </Link>
            <Link href="#upload" className="hover:text-white">
              Uploads
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
