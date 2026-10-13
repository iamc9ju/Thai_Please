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
    prototypeFeedback:
      'ตรวจสอบรูปแบบข้อมูลแล้ว ระบบต้นแบบนี้ยังไม่ได้เชื่อมต่อ API สำหรับเข้าสู่ระบบ',
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
