export const emojimap = {};
export const emojientr = {};

async function attemptGetEmojimap() {
	fetch('./emojimap.json')
		.then(x => x.json())
		.then(emap => {
			for(let [k,v] of Object.entries(emap)){
				emojimap[k[0]]??={};
				emojimap[k[0]][k]=v;
			}
			for(let [k,v] of Object.entries(emojimap)) {
				emojientr[k] = Object.entries(v)
					.filter(([k,v])=>!/(?:_tone\d|_(?:medium|dark|light|medium_dark|medium_light)_skin_tone)(?:_|$)/.test(k))
					.sort(([k1,v1],[k2,v2])=>k1.length>k2.length);
			}
		})
		.catch(e=>setTimeout(attempt_get_emojimap, 5000));
}
attemptGetEmojimap();
