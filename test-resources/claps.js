let clapsRef = db.collection('claps');

let openldap = clapsRef.doc('fjivdubfjv').set({
  url: 'http://localhost:1313/posts/openldap-helm-chart/', 
  claps: 5
});
