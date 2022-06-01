import { filter, all } from 'country-codes-list';
import { PhoneNumberUtil } from 'google-libphonenumber'
import logger from './logging'

class Country {
    CountryCode: string;
    CountryName: string;
    CallingCode: number;

    constructor(countryCode:any, name: any, callingCode: any) {
        this.CountryCode = countryCode
        this.CountryName = name,
        this.CallingCode = parseInt(callingCode)
    }
}

// @ts-ignore
export const countryList: Country[] = all().map((val: any, _: any) => new Country(val.countryCode, val.countryNameEn, val.countryCallingCode)).sort((a, b) => a.CountryName < b.CountryName ? -1 : 1)

export const countryDict = new Map<string, Country>()
for (var i = 0; i < countryList.length; i++) {
    countryDict.set(countryList[i].CountryCode, countryList[i])
}

let phoneUtil = PhoneNumberUtil.getInstance()

export const phoneLibSupportedCountries : Set<string> = new Set<string>(phoneUtil.getSupportedRegions())

export const phoneExampleDict : Map<string,number> = new Map<string, number>()
phoneLibSupportedCountries.forEach(c => phoneExampleDict.set(c,  phoneUtil.getExampleNumber(c).getNationalNumber()!));
