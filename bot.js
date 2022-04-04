import fetch from 'node-fetch';
import getPixels from "get-pixels";
import WebSocket from 'ws';

const VERSION_NUMBER = 2;

console.log(`PlaceNL headless client V${VERSION_NUMBER}`);

const args = process.argv.slice(2);

//if (args.length != 1 && !process.env.ACCESS_TOKEN) {
//    console.error("Missing access token.")
//    process.exit(1);
//}
if (args.length != 1 && !process.env.REDDIT_SESSION) {
    console.error("Missing reddit_session cookie.")
    process.exit(1);
}

let redditSessionCookies = (process.env.REDDIT_SESSION || args[0]).split(';');

var hasTokens = false;

let accessTokenHolders = [];
let defaultAccessToken;

if (redditSessionCookies.length > 4) {
    console.warn("Meer dan 4 reddit accounts per IP addres wordt niet geadviseerd!")
}

var socket;
var currentOrders;
var currentOrderList;

const COLOR_MAPPINGS = {
    '#6D001A': 0,
    '#BE0039': 1,
    '#FF4500': 2,
    '#FFA800': 3,
    '#FFD635': 4,
    '#FFF8B8': 5,
    '#00A368': 6,
    '#00CC78': 7,
    '#7EED56': 8,
    '#00756F': 9,
    '#009EAA': 10,
    '#00CCC0': 11,
    '#2450A4': 12,
    '#3690EA': 13,
    '#51E9F4': 14,
    '#493AC1': 15,
    '#6A5CFF': 16,
    '#94B3FF': 17,
    '#811E9F': 18,
    '#B44AC0': 19,
    '#E4ABFF': 20,
    '#DE107F': 21,
    '#FF3881': 22,
    '#FF99AA': 23,
    '#6D482F': 24,
    '#9C6926': 25,
    '#FFB470': 26,
    '#000000': 27,
    '#515252': 28,
    '#898D90': 29,
    '#D4D7D9': 30,
    '#FFFFFF': 31
};

let rgbaJoinH = (a1, a2, rowSize = 1000, cellSize = 4) => {
    const rawRowSize = rowSize * cellSize;
    const rows = a1.length / rawRowSize;
    let result = new Uint8Array(a1.length + a2.length);
    for (var row = 0; row < rows; row++) {
        result.set(a1.slice(rawRowSize * row, rawRowSize * (row+1)), rawRowSize * 2 * row);
        result.set(a2.slice(rawRowSize * row, rawRowSize * (row+1)), rawRowSize * (2 * row + 1));
    }
    return result;
};

let rgbaJoinV = (a1, a2, rowSize = 2000, cellSize = 4) => {
    let result = new Uint8Array(a1.length + a2.length);

    const rawRowSize = rowSize * cellSize;

    const rows1 = a1.length / rawRowSize;

    for (var row = 0; row < rows1; row++) {
        result.set(a1.slice(rawRowSize * row, rawRowSize * (row+1)), rawRowSize * row);
    }

    const rows2 = a2.length / rawRowSize;

    for (var row = 0; row < rows2; row++) {
        result.set(a2.slice(rawRowSize * row, rawRowSize * (row+1)), (rawRowSize * row) + a1.length);
    }

    return result;
};

let getRealWork = rgbaOrder => {
    let order = [];
    for (var i = 0; i < 4000000; i++) {
        if (rgbaOrder[(i * 4) + 3] !== 0) {
            order.push(i);
        }
    }
    return order;
};

let getPendingWork = (work, rgbaOrder, rgbaCanvas) => {
    let pendingWork = [];
    for (const i of work) {
        if (rgbaOrderToHex(i, rgbaOrder) !== rgbaOrderToHex(i, rgbaCanvas)) {
            pendingWork.push(i);
        }
    }
    return pendingWork;
};

(async function () {
    refreshTokens();
    connectSocket();

    startPlacement();

    setInterval(() => {
        if (socket) socket.send(JSON.stringify({ type: 'ping' }));
    }, 5000);
    // Refresh de tokens elke 30 minuten. Moet genoeg zijn toch.
    setInterval(refreshTokens, 30 * 60 * 1000);
})();

function startPlacement() {
    if (!hasTokens) {
        // Probeer over een seconde opnieuw.
        setTimeout(startPlacement, 10000);
        return
    }

    // Try to stagger pixel placement
    const interval = 300 / accessTokenHolders.length;
    var delay = 0;
    for (const accessTokenHolder of accessTokenHolders) {
        setTimeout(() => attemptPlace(accessTokenHolder), delay * 1000);
        delay += interval;
    }
}

async function refreshTokens() {
    if (accessTokenHolders.length === 0) {
        for (const _ of redditSessionCookies) {
            accessTokenHolders.push({});
        }
    }

    let tokens = [];
    for (const cookie of redditSessionCookies) {
        const response = await fetch("https://www.reddit.com/r/place/", {
            headers: {
                cookie: `reddit_session=${cookie}`
            }
        });
        const responseText = await response.text()

        let token = responseText.split('\"accessToken\":\"')[1].split('"')[0];
        tokens.push(token);
    }

    console.log("Refreshed tokens: ", tokens)
    tokens.forEach((token, idx) => {
        accessTokenHolders[idx].token = token;
    });
    defaultAccessToken = tokens[0];
    hasTokens = true;
}

function connectSocket() {
    console.log('Verbinden met PlaceNL server...')

    socket = new WebSocket('wss://placenl.noahvdaa.me/api/ws');

    socket.onerror = function(e) {
        console.error("Socket error: " + e.message)
    }

    socket.onopen = function () {
        console.log('Verbonden met PlaceNL server!')
        socket.send(JSON.stringify({ type: 'getmap' }));
        socket.send(JSON.stringify({ type: 'brand', brand: `nodeheadlessV${VERSION_NUMBER}` }));
    };

    socket.onmessage = async function (message) {
        var data;
        try {
            data = JSON.parse(message.data);
        } catch (e) {
            return;
        }

        switch (data.type.toLowerCase()) {
            case 'map':
                console.log(`Nieuwe map geladen (reden: ${data.reason ? data.reason : 'verbonden met server'})`)
                currentOrders = await getMapFromUrl(`http://jelcraft.zapto.org/rplace-ref.png`);
                currentOrderList = getRealWork(currentOrders.data);
                break;
            default:
                break;
        }
    };

    socket.onclose = function (e) {
        console.warn(`PlaceNL server heeft de verbinding verbroken: ${e.reason}`)
        console.error('Socketfout: ', e.reason);
        socket.close();
        setTimeout(connectSocket, 1000);
    };
}

async function attemptPlace(accessTokenHolder) {
    let retry = () => attemptPlace(accessTokenHolder);
    if (currentOrderList === undefined) {
        setTimeout(retry, 10000); // probeer opnieuw in 10sec.
        return;
    }
    
    var map0;
    var map1;
    var map2;
    var map3;
    try {
        map0 = await getMapFromUrl(await getCurrentImageUrl('0'));
        map1 = await getMapFromUrl(await getCurrentImageUrl('1'));
        map2 = await getMapFromUrl(await getCurrentImageUrl('2'));
        map3 = await getMapFromUrl(await getCurrentImageUrl('3'));
    } catch (e) {
        console.warn('Fout bij ophalen map: ', e);
        setTimeout(retry, 15000); // probeer opnieuw in 15sec.
        return;
    }

    const rgbaOrder = currentOrders.data;
    const rgbaCanvasH0 = rgbaJoinH(map0.data, map1.data);
    const rgbaCanvasH1 = rgbaJoinH(map2.data, map3.data);
    const rgbaCanvas = rgbaJoinV(rgbaCanvasH0, rgbaCanvasH1);
    const work = getPendingWork(currentOrderList, rgbaOrder, rgbaCanvas);

    if (work.length === 0) {
        console.log(`Alle pixels staan al op de goede plaats! Opnieuw proberen in 30 sec...`);
        setTimeout(retry, 30000); // probeer opnieuw in 30sec.
        return;
    }

    const percentComplete = 100 - Math.ceil(work.length * 100 / currentOrderList.length);
    const workRemaining = work.length;
    const idx = Math.floor(Math.random() * work.length);
    const i = work[idx];
    const x = i % 2000;
    const y = Math.floor(i / 2000);
    const hex = rgbaOrderToHex(i, rgbaOrder);

    console.log(`Proberen pixel te plaatsen op ${x}, ${y}... (${percentComplete}% compleet, nog ${workRemaining} over)`);

    const res = await place(x, y, COLOR_MAPPINGS[hex], accessTokenHolder.token);
    const data = await res.json();
    try {
        if (data.error || data.errors) {
            const error = data.error || data.errors[0];
            if (error.extensions && error.extensions.nextAvailablePixelTs) {
                const nextPixel = error.extensions.nextAvailablePixelTs + 3000;
                const nextPixelDate = new Date(nextPixel);
                const delay = nextPixelDate.getTime() - Date.now();
                console.log(`Pixel te snel geplaatst! Volgende pixel wordt geplaatst om ${nextPixelDate.toLocaleTimeString()}.`)
                setTimeout(retry, delay);
            } else {
                const message = error.message || error.reason || 'Unknown error';
                const guidance = message === 'user is not logged in' ? 'Heb je de "reddit_session" cookie goed gekopieerd?' : '';
                console.error(`[!!] Kritieke fout: ${message}. ${guidance}`);
                console.error(`[!!] Los dit op en herstart het script`);
            }
        } else {
            const nextPixel = data.data.act.data[0].data.nextAvailablePixelTimestamp + 3000;
            const nextPixelDate = new Date(nextPixel);
            const delay = nextPixelDate.getTime() - Date.now();
            console.log(`Pixel geplaatst op ${x}, ${y}! Volgende pixel wordt geplaatst om ${nextPixelDate.toLocaleTimeString()}.`)
            setTimeout(retry, delay);
        }
    } catch (e) {
        console.warn('Fout bij response analyseren', e);
        setTimeout(retry, 10000);
    }
}

function place(x, y, color, accessToken = defaultAccessToken) {
    socket.send(JSON.stringify({ type: 'placepixel', x, y, color }));
	return fetch('https://gql-realtime-2.reddit.com/query', {
		method: 'POST',
		body: JSON.stringify({
			'operationName': 'setPixel',
			'variables': {
				'input': {
					'actionName': 'r/replace:set_pixel',
					'PixelMessageData': {
						'coordinate': {
							'x': x % 1000,
							'y': y % 1000
						},
						'colorIndex': color,
						'canvasIndex': getCanvas(x, y)
					}
				}
			},
			'query': 'mutation setPixel($input: ActInput!) {\n  act(input: $input) {\n    data {\n      ... on BasicMessage {\n        id\n        data {\n          ... on GetUserCooldownResponseMessageData {\n            nextAvailablePixelTimestamp\n            __typename\n          }\n          ... on SetPixelResponseMessageData {\n            timestamp\n            __typename\n          }\n          __typename\n        }\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}\n'
		}),
		headers: {
			'origin': 'https://hot-potato.reddit.com',
			'referer': 'https://hot-potato.reddit.com/',
			'apollographql-client-name': 'mona-lisa',
			'Authorization': `Bearer ${accessToken}`,
			'Content-Type': 'application/json'
		}
	});
}

async function getCurrentImageUrl(id = '0') {
	return new Promise((resolve, reject) => {
		const ws = new WebSocket('wss://gql-realtime-2.reddit.com/query', 'graphql-ws', {
        headers : {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:98.0) Gecko/20100101 Firefox/98.0",
            "Origin": "https://hot-potato.reddit.com"
        }
      });

		ws.onopen = () => {
			ws.send(JSON.stringify({
				'type': 'connection_init',
				'payload': {
					'Authorization': `Bearer ${defaultAccessToken}`
				}
			}));

			ws.send(JSON.stringify({
				'id': '1',
				'type': 'start',
				'payload': {
					'variables': {
						'input': {
							'channel': {
								'teamOwner': 'AFD2022',
								'category': 'CANVAS',
								'tag': id
							}
						}
					},
					'extensions': {},
					'operationName': 'replace',
					'query': 'subscription replace($input: SubscribeInput!) {\n  subscribe(input: $input) {\n    id\n    ... on BasicMessage {\n      data {\n        __typename\n        ... on FullFrameMessageData {\n          __typename\n          name\n          timestamp\n        }\n      }\n      __typename\n    }\n    __typename\n  }\n}'
				}
			}));
		};

		ws.onmessage = (message) => {
			const { data } = message;
			const parsed = JSON.parse(data);

            if (parsed.type === 'connection_error') {
                console.error(`[!!] Kon /r/place map niet laden: ${parsed.payload.message}. Is de access token niet meer geldig?`);
            }

			// TODO: ew
			if (!parsed.payload || !parsed.payload.data || !parsed.payload.data.subscribe || !parsed.payload.data.subscribe.data) return;

			ws.close();
			resolve(parsed.payload.data.subscribe.data.name + `?noCache=${Date.now() * Math.random()}`);
		}


		ws.onerror = reject;
	});
}

function getMapFromUrl(url) {
    return new Promise((resolve, reject) => {
        getPixels(url, function(err, pixels) {
            if(err) {
                console.log("Bad image path")
                reject()
                return
            }
            resolve(pixels)
        })
    });
}

function getCanvas(x, y) {
    if (x <= 999) {
        return y <= 999 ? 0 : 2;
    } else {
        return y <= 999 ? 1 : 3;
    }
}

function rgbToHex(r, g, b) {
	return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

let rgbaOrderToHex = (i, rgbaOrder) =>
    rgbToHex(rgbaOrder[i * 4], rgbaOrder[i * 4 + 1], rgbaOrder[i * 4 + 2]);
