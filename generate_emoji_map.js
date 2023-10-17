const data = require("emojibase-data/en/shortcodes/github.json");
const { writeFileSync } = require("fs");
// let map=Object.fromEntries(Object.entries(data).map(([j,n])=>[n,String.fromCharPoint(...j.split("-").map(e=>parseInt(e,16)]))]));
let map = Object.fromEntries(Object.entries(data)
	.map(([j,n])=>[
		typeof n=="string"?n:n[0],
		String.fromCodePoint(...j.split("-").map(e=>parseInt(e,16)))
	])
)

writeFileSync(__dirname + "/www/emojimap.json", JSON.stringify(map));
