export const th = {
  brand: 'ไทยช่วยไทยพลีส',
  login: {
    brandEnglish: 'THAI CHUAY THAI PLEASE',
    backToWebsite: 'กลับไปที่เว็บไซต์',
    projectBadge: 'โครงการร่วมจ่ายเพื่อคนไทย',
    heroTitle: {
      primary: 'ช่วยลดค่าครองชีพ',
      secondary: 'เพิ่มรายได้ให้ชุมชน',
    },
    heroDescription:
      'ใช้จ่ายผ่าน Virtual Wallet รับสิทธิ์ร่วมจ่าย สะสมพอยต์จากภารกิจ และกลับมาสนับสนุนร้านค้าไทยใกล้บ้านอีกครั้ง',
    benefits: {
      label: 'สิทธิประโยชน์ของโครงการ',
      subsidy: 'รัฐช่วยจ่าย 60%',
      community: 'เพื่อร้านค้าชุมชน',
    },
    welcome: 'ยินดีต้อนรับ',
    title: 'เข้าสู่ระบบ',
    subtitle: 'เลือกประเภทบัญชีที่ต้องการเข้าใช้งาน',
    role: {
      label: 'ประเภทบัญชี',
      options: {
        consumer: 'ประชาชน',
        merchant: 'ร้านค้า',
        administrator: 'ผู้ดูแล',
      },
    },
    fields: {
      citizenId: {
        label: 'เลขประจำตัวประชาชน',
        placeholder: 'กรอกเลขประจำตัวประชาชน 13 หลัก',
      },
      password: {
        label: 'รหัสผ่าน',
        placeholder: 'กรอกรหัสผ่าน',
        show: 'แสดงรหัสผ่าน',
        hide: 'ซ่อนรหัสผ่าน',
      },
    },
    remember: 'จดจำข้อมูลของฉัน',
    forgotPassword: 'ลืมรหัสผ่าน?',
    submit: 'เข้าสู่ระบบ',
    validation: {
      citizenId: 'กรุณากรอกเลขประจำตัวประชาชนให้ครบ 13 หลัก',
    },
    invalidCredentials: 'เลขประจำตัวประชาชนหรือรหัสผ่านไม่ถูกต้อง',
    mockUnavailable:
      'Mock authentication ยังไม่พร้อมใช้งาน กรุณาตรวจสอบค่า VITE_MOCK_* ในไฟล์ .env',
    unavailableFeedback: 'ความสามารถนี้จะเปิดใช้งานในขั้นตอนถัดไป',
    registration: {
      prompt: 'ยังไม่มีบัญชี?',
      actions: {
        consumer: 'ลงทะเบียนประชาชน',
        merchant: 'ลงทะเบียนร้านค้า',
      },
    },
    support: {
      description: 'พบปัญหาการใช้งาน ติดต่อศูนย์ช่วยเหลือ',
      contact: '02-XXX-XXXX ในวันและเวลาราชการ',
    },
  },
  consumerDashboard: {
    brand: 'ไทยช่วยไทย',
    prototype: 'ข้อมูลจำลอง',
    greeting: 'สวัสดีตอนเช้า',
    displayName: 'สมชาย ใจดี',
    identityLabel: 'บัญชีประชาชน',
    logout: 'ออกจากระบบ',
    notification: 'การแจ้งเตือน',
    wallet: {
      eyebrow: 'กระเป๋าเงินของฉัน',
      title: 'Virtual Wallet',
      totalLabel: 'ยอดเงินที่ใช้ได้ทั้งหมด',
      personal: 'เงินส่วนตัว',
      subsidy: 'เงินสนับสนุน',
      dailyRemaining: 'สิทธิ์สนับสนุนคงเหลือวันนี้',
      dailyLimit: 'จากวงเงิน 200 บาทต่อวัน',
      topUp: 'เติมเงิน',
      history: 'ประวัติ Wallet',
    },
    payment: {
      title: 'สแกนเพื่อชำระเงิน',
      description: 'สแกน QR ของร้านค้า แล้วตรวจสอบรายการก่อนยืนยันชำระ',
      action: 'สแกน QR',
    },
    points: {
      title: 'คะแนนสะสม',
      unit: 'พอยต์',
      history: 'ดูประวัติคะแนน',
      expiring: '50 พอยต์จะหมดอายุ 31 ธ.ค. 2569',
    },
    quest: {
      eyebrow: 'ภารกิจแนะนำสำหรับคุณ',
      title: 'อุดหนุนร้านอาหารชุมชน',
      description: 'ซื้ออาหารครบ 100 บาท ภายใน 1 คำสั่งซื้อ',
      reward: '+50 พอยต์',
      expiry: 'หมดเขต 20 ต.ค. 2569',
      progressLabel: 'ความคืบหน้าภารกิจ',
      progress: 'ยังไม่สำเร็จ',
      viewAll: 'ดูภารกิจทั้งหมด',
    },
    coupons: {
      title: 'คูปองของฉัน',
      count: 'มีคูปองพร้อมใช้ 2 ใบ',
      first: 'ลด 20 บาท เมื่อซื้อครบ 150 บาท',
      second: 'ลด 10% สูงสุด 30 บาท',
      viewAll: 'ดูคูปองทั้งหมด',
    },
    activity: {
      title: 'รายการล่าสุด',
      viewAll: 'ดูทั้งหมด',
      items: [
        {
          merchant: 'ร้านครัวบ้านเรา',
          detail: 'ชำระด้วย Wallet · วันนี้ 10:42',
          amount: '-120.00 บาท',
        },
        {
          merchant: 'เติมเงินส่วนตัว',
          detail: 'รายการจำลอง · เมื่อวาน 18:10',
          amount: '+500.00 บาท',
        },
        {
          merchant: 'ร้านชุมชนสุขใจ',
          detail: 'ชำระด้วย Wallet · 11 ต.ค. 2569',
          amount: '-85.00 บาท',
        },
      ],
    },
    navigation: {
      home: 'หน้าหลัก',
      orders: 'รายการซื้อ',
      quests: 'ภารกิจ',
      coupons: 'คูปอง',
      profile: 'โปรไฟล์',
    },
    pendingAction: 'ความสามารถนี้เป็นส่วนหนึ่งของ UI Draft และยังไม่เชื่อม API',
  },
  rolePreview: {
    merchantTitle: 'เข้าสู่ระบบร้านค้าสำเร็จ',
    administratorTitle: 'เข้าสู่ระบบผู้ดูแลสำเร็จ',
    description: 'บัญชี Mock ถูกต้องแล้ว หน้าสำหรับบทบาทนี้จะพัฒนาในลำดับถัดไป',
    back: 'กลับหน้าเข้าสู่ระบบ',
  },
  prototypeLabel: 'ต้นแบบระบบ Virtual Money',
  eyebrow: 'ใช้จ่ายในชุมชนอย่างมีความหมาย',
  heroTitle: 'เปลี่ยนทุกการใช้จ่ายให้เป็นแรงสนับสนุนร้านค้าไทย',
  heroDescription:
    'แพลตฟอร์มที่เชื่อม POS, Virtual Wallet และภารกิจเฉพาะบุคคล เพื่อสร้างการกลับมาใช้จ่ายซ้ำและวัดผลลัพธ์ต่อชุมชนได้จริง',
  primaryAction: 'สำรวจความสามารถ',
  secondaryAction: 'ดูวงจรการใช้งาน',
  flow: {
    ariaLabel: 'วงจรการใช้งานของระบบ',
    title: 'วงจรคุณค่าของแพลตฟอร์ม',
    steps: ['ใช้จ่าย', 'ทำภารกิจ', 'รับพอยต์', 'แลกคูปอง', 'กลับมาใช้จ่าย'],
  },
  capabilities: {
    eyebrow: 'ออกแบบเพื่อทุกบทบาท',
    title: 'ระบบเดียว เชื่อมผู้บริโภค ร้านค้า และผู้ดูแลโครงการ',
  },
  roles: {
    consumer: {
      title: 'ผู้บริโภค',
      description:
        'ชำระเงินผ่าน QR ดู Wallet ภารกิจ พอยต์ และคูปองได้อย่างโปร่งใส',
    },
    merchant: {
      title: 'ร้านค้า',
      description:
        'จัดการสินค้า สร้างรายการขาย และติดตามผลลัพธ์จากภารกิจผ่าน POS',
    },
    administrator: {
      title: 'ผู้ดูแลโครงการ',
      description:
        'กำกับนโยบายรางวัลและติดตามผลกระทบทางเศรษฐกิจจากข้อมูลธุรกรรมจริง',
    },
  },
  footer: 'สร้างบนหลักความถูกต้อง ความปลอดภัย และการตรวจสอบย้อนหลังได้',
} as const;
