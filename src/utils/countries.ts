import { all } from 'country-codes-list';
import { PhoneNumberUtil } from 'google-libphonenumber';

interface Country {
  countryCode: string;
  countryName: string;
  callingCode: number;
}

export const countryList: Country[] = all().map((val: any, _: any): Country => ({ countryCode: val.countryCode, countryName: val.countryNameEn, callingCode: val.countryCallingCode }))
  .sort((a: Country, b: Country) => (a.countryName < b.countryName ? -1 : 1));

export const countryDict: Map<string, Country> = new Map<string, Country>();
countryList.forEach((country) => {
  countryDict.set(country.countryCode, country);
});

const phoneUtil = PhoneNumberUtil.getInstance();

export const phoneLibSupportedCountries : Set<string> = new Set<string>(phoneUtil.getSupportedRegions());

export const phoneExampleDict : Map<string, number> = new Map<string, number>();
phoneLibSupportedCountries.forEach((c) => phoneExampleDict.set(c, phoneUtil.getExampleNumber(c).getNationalNumber()!));
