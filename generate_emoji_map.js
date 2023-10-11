const data = require("emojibase-data/en/shortcodes/joypixels.json");
const { writeFileSync } = require("fs");
// let map=Object.fromEntries(Object.entries(data).map(([j,n])=>[n,String.fromCharPoint(...j.split("-").map(e=>parseInt(e,16)]))]));
let map = Object.fromEntries(Object.entries(data).map(([j,n])=>[n,String.fromCodePoint(...j.split("-").map(e=>parseInt(e,16)))]))
writeFileSync(__dirname + "/www/emojimap.json", JSON.stringify(map));
