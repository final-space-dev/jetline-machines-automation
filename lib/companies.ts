export type Company = {
  schema: string;
  name: string;
  switch: 'ON' | 'OFF';
  host: string;
  port: number;
  split: 'CORPORATE' | 'STORES';
};

export const companies: Company[] = [
  { schema: 'corporateprintbms2', name: 'Jetline Corporate', switch: 'ON', host: '172.20.251.127', port: 3306, split: 'CORPORATE' },
  { schema: 'burlingtonbms2', name: 'Burlington', switch: 'ON', host: '172.20.251.127', port: 3306, split: 'CORPORATE' },
  { schema: 'typoprintingbms2', name: 'Typo', switch: 'ON', host: '172.20.251.127', port: 3306, split: 'CORPORATE' },
  { schema: 'anglobms2', name: 'Anglo', switch: 'ON', host: '172.20.251.127', port: 3306, split: 'CORPORATE' },
  { schema: 'formattsolutionsbms2', name: 'Formatt', switch: 'ON', host: '172.20.251.127', port: 3306, split: 'CORPORATE' },
  { schema: 'landkbms2', name: 'L and K', switch: 'ON', host: '172.20.251.127', port: 3306, split: 'CORPORATE' },
  { schema: 'marinsbms2', name: 'Marins', switch: 'ON', host: '172.20.251.127', port: 3306, split: 'CORPORATE' },
  { schema: '25amcpsbms2', name: 'Corporate Print 25AM', switch: 'ON', host: '172.20.251.127', port: 3306, split: 'CORPORATE' },
  { schema: 'masterskillbms2', name: 'Masterskill', switch: 'ON', host: '172.20.251.127', port: 3306, split: 'CORPORATE' },
  { schema: 'nscbms2', name: 'Fixtrade', switch: 'ON', host: '172.20.251.127', port: 3306, split: 'CORPORATE' },
  { schema: 'pocketmediabms2', name: 'Pocket Media', switch: 'ON', host: '172.20.251.127', port: 3306, split: 'CORPORATE' },
  { schema: 'raptorbms2', name: 'Raptor', switch: 'ON', host: '172.20.251.127', port: 3306, split: 'CORPORATE' },
  { schema: 'systemprintbms2', name: 'SystemPrint', switch: 'ON', host: '172.20.251.127', port: 3306, split: 'CORPORATE' },
  { schema: 'firstlabelsbms2', name: 'First Labels', switch: 'ON', host: '172.20.251.127', port: 3306, split: 'CORPORATE' },
  { schema: 'welkombms2', name: 'Welkom', switch: 'ON', host: '172.20.251.127', port: 3306, split: 'CORPORATE' },
  { schema: 'witbankbms2', name: 'Witbank', switch: 'ON', host: '172.20.251.127', port: 3306, split: 'CORPORATE' },
  { schema: 'gardensbms2', name: 'Gardens', switch: 'ON', host: 'wizardzgardens.jetlinestores.co.za', port: 3306, split: 'STORES' },
  { schema: 'printoutsolutionsbms2', name: 'PrintOut', switch: 'ON', host: '172.20.251.127', port: 3306, split: 'CORPORATE' },
  { schema: 'waterfrontbms2', name: 'Waterfront', switch: 'ON', host: 'wizardzwaterfront.jetlinestores.co.za', port: 3306, split: 'STORES' },
  { schema: 'centurycitybms2', name: 'Century City', switch: 'ON', host: 'centurycity.jetlinestores.co.za', port: 3306, split: 'STORES' },
  { schema: 'albertonbms2', name: 'Alberton', switch: 'ON', host: 'alberton.jetlinestores.co.za', port: 3306, split: 'STORES' },
  { schema: 'bedfordviewbms2', name: 'Bedfordview', switch: 'ON', host: 'bedfordview.jetlinestores.co.za', port: 3306, split: 'STORES' },
  { schema: 'blackheathbms2', name: 'Blackheath', switch: 'ON', host: 'blackheath.jetlinestores.co.za', port: 3306, split: 'STORES' },
  { schema: 'boksburgbms2', name: 'Boksburg', switch: 'ON', host: 'boksburg.jetlinestores.co.za', port: 3306, split: 'STORES' },
  { schema: 'benonibms2', name: 'Benoni', switch: 'ON', host: 'benoni.jetlinestores.co.za', port: 3306, split: 'STORES' },
  { schema: 'bryanstonbms2', name: 'Bryanston', switch: 'ON', host: 'bryanston.jetlinestores.co.za', port: 3306, split: 'STORES' },
  { schema: 'durbanbms2', name: 'Durban', switch: 'ON', host: 'durban.jetlinestores.co.za', port: 3306, split: 'STORES' },
  { schema: 'foxstreetbms2', name: 'Foxstreet', switch: 'ON', host: 'foxstreet.jetlinestores.co.za', port: 3306, split: 'STORES' },
  { schema: 'parktowncorporateprintbms2', name: 'Hillcrestcps', switch: 'ON', host: 'parktown.jetlinestores.co.za', port: 3306, split: 'STORES' },
  { schema: 'hillcrestbms2', name: 'Hillcrest', switch: 'ON', host: 'hillcrest.jetlinestores.co.za', port: 3306, split: 'STORES' },
  { schema: 'kyalamibms2', name: 'Kyalami', switch: 'ON', host: 'kyalami.jetlinestores.co.za', port: 3306, split: 'STORES' },
  { schema: 'melrosebms2', name: 'Melrose', switch: 'ON', host: 'melrose.jetlinestores.co.za', port: 3306, split: 'STORES' },
  { schema: 'menlynbms2', name: 'Menlyn', switch: 'ON', host: 'menlyn.jetlinestores.co.za', port: 3306, split: 'STORES' },
  { schema: 'parktownbms2', name: 'Parktown', switch: 'ON', host: 'parktown.jetlinestores.co.za', port: 3306, split: 'STORES' },
  { schema: 'pietermaritzburgbms2', name: 'Pietermaritzburg', switch: 'ON', host: 'pietermaritzburg.jetlinestores.co.za', port: 3306, split: 'STORES' },
  { schema: 'sunninghillbms2', name: 'Sunninghill', switch: 'ON', host: 'sunninghill.jetlinestores.co.za', port: 3306, split: 'STORES' },
  { schema: 'polokwanebms2', name: 'Polokwane', switch: 'ON', host: 'polokwane.jetlinestores.co.za', port: 3306, split: 'STORES' },
  { schema: 'rivoniabms2', name: 'Rivonia', switch: 'ON', host: 'rivonia.jetlinestores.co.za', port: 3306, split: 'STORES' },
  { schema: 'rosebankbms2', name: 'Rosebank', switch: 'ON', host: 'rosebank.jetlinestores.co.za', port: 3306, split: 'STORES' },
  { schema: 'rustenburgbms2', name: 'Rustenburg', switch: 'ON', host: 'rustenburg.jetlinestores.co.za', port: 3306, split: 'STORES' },
  { schema: 'sandownbms2', name: 'Sandown', switch: 'ON', host: 'sandown.jetlinestores.co.za', port: 3306, split: 'STORES' },
  { schema: 'illovobms2', name: 'Illovo', switch: 'ON', host: 'illovo.jetlinestores.co.za', port: 3306, split: 'STORES' },
  { schema: 'montanabms2', name: 'Montana', switch: 'ON', host: 'montana.jetlinestores.co.za', port: 3306, split: 'STORES' },
  { schema: 'brooklynbms2', name: 'Brooklyn', switch: 'ON', host: 'brooklyn.jetlinestores.co.za', port: 3306, split: 'STORES' },
  { schema: 'potchbms2', name: 'Potchefstroom', switch: 'ON', host: 'potchefstroom.jetlinestores.co.za', port: 3306, split: 'STORES' },
  { schema: 'woodmeadbms2', name: 'Woodmead', switch: 'ON', host: 'woodmead.jetlinestores.co.za', port: 3306, split: 'STORES' },
  { schema: 'georgebms2', name: 'George', switch: 'ON', host: 'george.jetlinestores.co.za', port: 3306, split: 'STORES' },
  { schema: 'modderfonteinbms2', name: 'Modderfontein', switch: 'ON', host: 'modderfontein.jetlinestores.co.za', port: 3306, split: 'STORES' },
  { schema: 'vaalreefsbms2', name: 'Vaalreefs', switch: 'ON', host: 'vaalreefs.jetlinestores.co.za', port: 3306, split: 'STORES' },
  { schema: 'klerksdorpbms2', name: 'Klerksdorp', switch: 'ON', host: 'klerksdorp.jetlinestores.co.za', port: 3306, split: 'STORES' },
  { schema: 'greenpointbms2', name: 'Greenpoint', switch: 'ON', host: 'greenpoint.jetlinestores.co.za', port: 3306, split: 'STORES' },
  { schema: 'randburgbms2', name: 'Randburg', switch: 'ON', host: 'randburg.jetlinestores.co.za', port: 3306, split: 'STORES' },
  { schema: 'hydeparkbms2', name: 'Hydepark', switch: 'ON', host: 'hydepark.jetlinestores.co.za', port: 3306, split: 'STORES' },
  { schema: 'fourwaysbms2', name: 'Fourways', switch: 'ON', host: 'fourways.jetlinestores.co.za', port: 3306, split: 'STORES' },
  { schema: 'centurionbms2', name: 'Centurion', switch: 'ON', host: 'centurion.jetlinestores.co.za', port: 3306, split: 'STORES' },
  { schema: 'nelspruitbms2', name: 'Nelspruit', switch: 'ON', host: 'nelspruit.jetlinestores.co.za', port: 3306, split: 'STORES' },
  { schema: 'witsbms2', name: 'Wits', switch: 'ON', host: 'wits.jetlinestores.co.za', port: 3306, split: 'STORES' },
  { schema: 'constantiabms2', name: 'Constantia', switch: 'ON', host: 'constantia.jetlinestores.co.za', port: 3306, split: 'STORES' },
  { schema: 'stellenboschbms2', name: 'Stellenbosch', switch: 'ON', host: 'stellenbosch.jetlinestores.co.za', port: 3306, split: 'STORES' },
  { schema: 'tygervalleybms2', name: 'Tygervalley', switch: 'ON', host: 'tygervalley.jetlinestores.co.za', port: 3306, split: 'STORES' },
  { schema: 'midrandbms2', name: 'Midrand', switch: 'ON', host: 'midrand.jetlinestores.co.za', port: 3306, split: 'STORES' },
  { schema: 'mmabathobms2', name: 'Mmabatho', switch: 'ON', host: 'mmabatho.jetlinestores.co.za', port: 3306, split: 'STORES' },
  { schema: 'zarabms2', name: 'Zara', switch: 'OFF', host: '172.20.251.127', port: 3306, split: 'CORPORATE' },
  { schema: 'ballitobms2', name: 'Ballito', switch: 'ON', host: 'ballito.jetlinestores.co.za', port: 3306, split: 'STORES' }
];

export const getActiveCompanies = (limit?: number) => {
  const active = companies.filter((c) => c.switch === 'ON');
  return typeof limit === 'number' ? active.slice(0, limit) : active;
};
