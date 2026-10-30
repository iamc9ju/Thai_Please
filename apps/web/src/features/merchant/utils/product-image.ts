export const CLOUDINARY_DEFAULT_PRODUCT_IMAGES = {
  'agri-product':
    'https://res.cloudinary.com/dfxf4u91m/image/upload/v1793351613/thai-please-agri-product.jpg',
  'dates-fruit':
    'https://res.cloudinary.com/dfxf4u91m/image/upload/v1793351614/thai-please-dates-fruit.jpg',
  'drinking-water':
    'https://res.cloudinary.com/dfxf4u91m/image/upload/v1793351615/thai-please-drinking-water.jpg',
  'food-drink-combo':
    'https://res.cloudinary.com/dfxf4u91m/image/upload/v1793351616/thai-please-food-drink-combo.jpg',
  'fried-egg-rice':
    'https://res.cloudinary.com/dfxf4u91m/image/upload/v1793351617/thai-please-fried-egg-rice.jpg',
  'garlic-pork-rice':
    'https://res.cloudinary.com/dfxf4u91m/image/upload/v1793351618/thai-please-garlic-pork-rice.jpg',
  'jasmine-rice':
    'https://res.cloudinary.com/dfxf4u91m/image/upload/v1793351619/thai-please-jasmine-rice.jpg',
  'kaprao-chicken':
    'https://res.cloudinary.com/dfxf4u91m/image/upload/v1793351620/thai-please-kaprao-chicken.jpg',
  'kaprao-pork':
    'https://res.cloudinary.com/dfxf4u91m/image/upload/v1793351620/thai-please-kaprao-pork.jpg',
  'milk-tea':
    'https://res.cloudinary.com/dfxf4u91m/image/upload/v1793351621/thai-please-milk-tea.jpg',
  'omelet-rice':
    'https://res.cloudinary.com/dfxf4u91m/image/upload/v1793351622/thai-please-omelet-rice.jpg',
  'otop-product':
    'https://res.cloudinary.com/dfxf4u91m/image/upload/v1793351623/thai-please-otop-product.jpg',
  'pork-fried-rice':
    'https://res.cloudinary.com/dfxf4u91m/image/upload/v1793351624/thai-please-pork-fried-rice.jpg',
  'thai-iced-tea':
    'https://res.cloudinary.com/dfxf4u91m/image/upload/v1793351625/thai-please-thai-iced-tea.jpg',
  'tofu-pork-soup':
    'https://res.cloudinary.com/dfxf4u91m/image/upload/v1793351625/thai-please-tofu-pork-soup.jpg',
} as const;

export function resolveProductImage(
  productName: string,
  categoryName?: string,
  imageUrl?: string | null,
): string {
  if (imageUrl && imageUrl.trim().length > 0) {
    return imageUrl.trim();
  }

  const name = productName.trim().toLowerCase();
  const category = (categoryName ?? '').trim().toLowerCase();

  if (name.includes('กะเพราไก่') || name.includes('กระเพราไก่')) {
    return CLOUDINARY_DEFAULT_PRODUCT_IMAGES['kaprao-chicken'];
  }
  if (name.includes('กะเพรา') || name.includes('กระเพรา')) {
    return CLOUDINARY_DEFAULT_PRODUCT_IMAGES['kaprao-pork'];
  }
  if (name.includes('หมูกระเทียม') || name.includes('กระเทียม')) {
    return CLOUDINARY_DEFAULT_PRODUCT_IMAGES['garlic-pork-rice'];
  }
  if (name.includes('ข้าวผัด')) {
    return CLOUDINARY_DEFAULT_PRODUCT_IMAGES['pork-fried-rice'];
  }
  if (name.includes('ไข่เจียว')) {
    return CLOUDINARY_DEFAULT_PRODUCT_IMAGES['omelet-rice'];
  }
  if (name.includes('ไข่ดาว')) {
    return CLOUDINARY_DEFAULT_PRODUCT_IMAGES['fried-egg-rice'];
  }
  if (
    name.includes('ต้มจืด') ||
    name.includes('แกงจืด') ||
    name.includes('เต้าหู้')
  ) {
    return CLOUDINARY_DEFAULT_PRODUCT_IMAGES['tofu-pork-soup'];
  }
  if (name.includes('ข้าวสวย') || name.includes('ข้าวเปล่า')) {
    return CLOUDINARY_DEFAULT_PRODUCT_IMAGES['jasmine-rice'];
  }
  if (name.includes('ชาไทย') || name.includes('ชาเย็น')) {
    return CLOUDINARY_DEFAULT_PRODUCT_IMAGES['thai-iced-tea'];
  }
  if (
    name.includes('ชานม') ||
    name.includes('กาแฟ') ||
    name.includes('นมสด') ||
    name.includes('โกโก้')
  ) {
    return CLOUDINARY_DEFAULT_PRODUCT_IMAGES['milk-tea'];
  }
  if (
    name.includes('น้ำดื่ม') ||
    name.includes('น้ำเปล่า') ||
    name.includes('น้ำแร่') ||
    name.includes('น้ำสมุนไพร')
  ) {
    return CLOUDINARY_DEFAULT_PRODUCT_IMAGES['drinking-water'];
  }
  if (name.includes('อินทพาลัม') || name.includes('อินทผาลัม')) {
    return CLOUDINARY_DEFAULT_PRODUCT_IMAGES['dates-fruit'];
  }
  if (name.includes('เกษตร') || category.includes('เกษตร')) {
    return CLOUDINARY_DEFAULT_PRODUCT_IMAGES['agri-product'];
  }
  if (
    name.includes('otop') ||
    category.includes('otop') ||
    name.includes('วิสาหกิจ') ||
    name.includes('ชุมชน')
  ) {
    return CLOUDINARY_DEFAULT_PRODUCT_IMAGES['otop-product'];
  }

  return CLOUDINARY_DEFAULT_PRODUCT_IMAGES['food-drink-combo'];
}
