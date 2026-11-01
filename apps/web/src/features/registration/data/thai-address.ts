import rawAddressData from './thai-address-data.json';

type RawSubdistrictTuple = [name: string, postalCode: string];

type RawDistrictEntry = {
  n: string;
  s: RawSubdistrictTuple[];
};

type RawProvinceEntry = {
  p: string;
  d: RawDistrictEntry[];
};

export type ThaiSubdistrictOption = Readonly<{
  name: string;
  postalCode: string;
}>;

const addressData = rawAddressData as RawProvinceEntry[];

const provinceMap = new Map<string, Map<string, ThaiSubdistrictOption[]>>();

for (const prov of addressData) {
  const districtMap = new Map<string, ThaiSubdistrictOption[]>();
  for (const dist of prov.d) {
    // Deduplicate subdistrict names within the same district if any exist
    const seen = new Set<string>();
    const subdistricts: ThaiSubdistrictOption[] = [];
    for (const [subName, zip] of dist.s) {
      if (!seen.has(subName)) {
        seen.add(subName);
        subdistricts.push({ name: subName, postalCode: zip });
      }
    }
    districtMap.set(dist.n, subdistricts);
  }
  provinceMap.set(prov.p, districtMap);
}

export const THAI_PROVINCES: readonly string[] = addressData.map(
  (entry) => entry.p,
);

export function getDistrictsByProvince(province: string): readonly string[] {
  if (!province) return [];
  const districtMap = provinceMap.get(province);
  if (!districtMap) return [];
  return Array.from(districtMap.keys());
}

export function getSubdistrictsByDistrict(
  province: string,
  district: string,
): readonly ThaiSubdistrictOption[] {
  if (!province || !district) return [];
  const districtMap = provinceMap.get(province);
  if (!districtMap) return [];
  return districtMap.get(district) ?? [];
}

export function getPostalCodeForSubdistrict(
  province: string,
  district: string,
  subdistrict: string,
): string {
  const subdistricts = getSubdistrictsByDistrict(province, district);
  const match = subdistricts.find((item) => item.name === subdistrict);
  return match?.postalCode ?? '';
}
