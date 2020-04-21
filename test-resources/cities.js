let citiesRef = db.collection('cities');

let setSf = citiesRef.doc('SF').set({
  name: 'San Francisco', state: 'CA', country: 'USA',
  capital: false, population: 860000,
  regions: ['west_coast', 'norcal']
});
let setLa = citiesRef.doc('LA').set({
  name: 'Los Angeles', state: 'CA', country: 'USA',
  capital: false, population: 3900000,
  regions: ['west_coast', 'socal']
});
let setDc = citiesRef.doc('DC').set({
  name: 'Washington, D.C.', state: null, country: 'USA',
  capital: true, population: 680000,
  regions: ['east_coast']
});
let setTok = citiesRef.doc('TOK').set({
  name: 'Tokyo', state: null, country: 'Japan',
  capital: true, population: 9000000,
  regions: ['kanto', 'honshu']
});
let setBj = citiesRef.doc('BJ').set({
  name: 'Beijing', state: null, country: 'China',
  capital: true, population: 21500000,
  regions: ['jingjinji', 'hebei']
});