// World Cup 2026 Venue Data
// Host cities: USA (11), Mexico (3), Canada (2)

export interface Venue {
  stadium: string;
  city: string;
  country: string;
}

// Map match IDs to venues (based on FIFA World Cup 2026 schedule)
export const matchVenues: Record<number, Venue> = {
  // Group Stage - Matchday 1
  537325: { stadium: "Estadio Azteca", city: "Mexico City", country: "MEX" }, // Opening: MEX vs RSA
  537326: { stadium: "BC Place", city: "Vancouver", country: "CAN" }, // KOR vs TBD
  537327: { stadium: "Estadio Azteca", city: "Mexico City", country: "MEX" }, // Group A: MEX vs RSA
  537328: { stadium: "BC Place", city: "Vancouver", country: "CAN" }, // Group A: KOR vs TBD
  537333: { stadium: "Rose Bowl", city: "Los Angeles", country: "USA" },
  537334: { stadium: "Levi's Stadium", city: "San Francisco", country: "USA" },
  537339: { stadium: "MetLife Stadium", city: "New York", country: "USA" },
  537340: { stadium: "Hard Rock Stadium", city: "Miami", country: "USA" },
  537345: { stadium: "AT&T Stadium", city: "Dallas", country: "USA" },
  537346: { stadium: "NRG Stadium", city: "Houston", country: "USA" },
  537351: { stadium: "Mercedes-Benz Stadium", city: "Atlanta", country: "USA" },
  537352: { stadium: "Lincoln Financial Field", city: "Philadelphia", country: "USA" },
  537357: { stadium: "Gillette Stadium", city: "Boston", country: "USA" },
  537358: { stadium: "Lumen Field", city: "Seattle", country: "USA" },
  537363: { stadium: "Arrowhead Stadium", city: "Kansas City", country: "USA" },
  537364: { stadium: "BMO Field", city: "Toronto", country: "CAN" },
  537369: { stadium: "SoFi Stadium", city: "Los Angeles", country: "USA" },
  537370: { stadium: "Estadio BBVA", city: "Monterrey", country: "MEX" },
  537391: { stadium: "Rose Bowl", city: "Los Angeles", country: "USA" },
  537392: { stadium: "Levi's Stadium", city: "San Francisco", country: "USA" },
  537397: { stadium: "Hard Rock Stadium", city: "Miami", country: "USA" },
  537398: { stadium: "MetLife Stadium", city: "New York", country: "USA" },
  537403: { stadium: "AT&T Stadium", city: "Dallas", country: "USA" },
  537404: { stadium: "NRG Stadium", city: "Houston", country: "USA" },
  537409: { stadium: "Mercedes-Benz Stadium", city: "Atlanta", country: "USA" },
  537410: { stadium: "Lincoln Financial Field", city: "Philadelphia", country: "USA" },

  // Group Stage - Matchday 2
  537329: { stadium: "BC Place", city: "Vancouver", country: "CAN" },
  537330: { stadium: "Estadio Azteca", city: "Mexico City", country: "MEX" },
  537335: { stadium: "Gillette Stadium", city: "Boston", country: "USA" },
  537336: { stadium: "BMO Field", city: "Toronto", country: "CAN" },
  537341: { stadium: "Rose Bowl", city: "Los Angeles", country: "USA" },
  537342: { stadium: "Levi's Stadium", city: "San Francisco", country: "USA" },
  537347: { stadium: "AT&T Stadium", city: "Dallas", country: "USA" },
  537348: { stadium: "NRG Stadium", city: "Houston", country: "USA" },
  537353: { stadium: "Mercedes-Benz Stadium", city: "Atlanta", country: "USA" },
  537354: { stadium: "Hard Rock Stadium", city: "Miami", country: "USA" },
  537359: { stadium: "MetLife Stadium", city: "New York", country: "USA" },
  537360: { stadium: "Lincoln Financial Field", city: "Philadelphia", country: "USA" },
  537365: { stadium: "Arrowhead Stadium", city: "Kansas City", country: "USA" },
  537366: { stadium: "Lumen Field", city: "Seattle", country: "USA" },
  537371: { stadium: "SoFi Stadium", city: "Los Angeles", country: "USA" },
  537372: { stadium: "Estadio BBVA", city: "Monterrey", country: "MEX" },
  537393: { stadium: "Rose Bowl", city: "Los Angeles", country: "USA" },
  537394: { stadium: "Gillette Stadium", city: "Boston", country: "USA" },
  537399: { stadium: "Hard Rock Stadium", city: "Miami", country: "USA" },
  537400: { stadium: "AT&T Stadium", city: "Dallas", country: "USA" },
  537405: { stadium: "NRG Stadium", city: "Houston", country: "USA" },
  537406: { stadium: "Mercedes-Benz Stadium", city: "Atlanta", country: "USA" },
  537411: { stadium: "Lincoln Financial Field", city: "Philadelphia", country: "USA" },
  537412: { stadium: "Lumen Field", city: "Seattle", country: "USA" },

  // Group Stage - Matchday 3
  537331: { stadium: "Estadio Azteca", city: "Mexico City", country: "MEX" },
  537332: { stadium: "BC Place", city: "Vancouver", country: "CAN" },
  537337: { stadium: "BMO Field", city: "Toronto", country: "CAN" },
  537338: { stadium: "Gillette Stadium", city: "Boston", country: "USA" },
  537343: { stadium: "Rose Bowl", city: "Los Angeles", country: "USA" },
  537344: { stadium: "Levi's Stadium", city: "San Francisco", country: "USA" },
  537349: { stadium: "AT&T Stadium", city: "Dallas", country: "USA" },
  537350: { stadium: "NRG Stadium", city: "Houston", country: "USA" },
  537355: { stadium: "Mercedes-Benz Stadium", city: "Atlanta", country: "USA" },
  537356: { stadium: "Hard Rock Stadium", city: "Miami", country: "USA" },
  537361: { stadium: "MetLife Stadium", city: "New York", country: "USA" },
  537362: { stadium: "Lincoln Financial Field", city: "Philadelphia", country: "USA" },
  537367: { stadium: "Arrowhead Stadium", city: "Kansas City", country: "USA" },
  537368: { stadium: "Lumen Field", city: "Seattle", country: "USA" },
  537373: { stadium: "SoFi Stadium", city: "Los Angeles", country: "USA" },
  537374: { stadium: "Estadio BBVA", city: "Monterrey", country: "MEX" },
  537395: { stadium: "Rose Bowl", city: "Los Angeles", country: "USA" },
  537396: { stadium: "Gillette Stadium", city: "Boston", country: "USA" },
  537401: { stadium: "Hard Rock Stadium", city: "Miami", country: "USA" },
  537402: { stadium: "AT&T Stadium", city: "Dallas", country: "USA" },
  537407: { stadium: "NRG Stadium", city: "Houston", country: "USA" },
  537408: { stadium: "Mercedes-Benz Stadium", city: "Atlanta", country: "USA" },
  537413: { stadium: "Lincoln Financial Field", city: "Philadelphia", country: "USA" },
  537414: { stadium: "Lumen Field", city: "Seattle", country: "USA" },

  // Round of 32
  537415: { stadium: "Rose Bowl", city: "Los Angeles", country: "USA" },
  537416: { stadium: "AT&T Stadium", city: "Dallas", country: "USA" },
  537417: { stadium: "MetLife Stadium", city: "New York", country: "USA" },
  537418: { stadium: "Hard Rock Stadium", city: "Miami", country: "USA" },
  537419: { stadium: "SoFi Stadium", city: "Los Angeles", country: "USA" },
  537420: { stadium: "NRG Stadium", city: "Houston", country: "USA" },
  537421: { stadium: "Mercedes-Benz Stadium", city: "Atlanta", country: "USA" },
  537422: { stadium: "Arrowhead Stadium", city: "Kansas City", country: "USA" },
  537423: { stadium: "Levi's Stadium", city: "San Francisco", country: "USA" },
  537424: { stadium: "Lincoln Financial Field", city: "Philadelphia", country: "USA" },
  537425: { stadium: "Gillette Stadium", city: "Boston", country: "USA" },
  537426: { stadium: "BC Place", city: "Vancouver", country: "CAN" },
  537427: { stadium: "BMO Field", city: "Toronto", country: "CAN" },
  537428: { stadium: "Estadio Azteca", city: "Mexico City", country: "MEX" },
  537429: { stadium: "Estadio BBVA", city: "Monterrey", country: "MEX" },
  537430: { stadium: "Lumen Field", city: "Seattle", country: "USA" },

  // Round of 16
  537375: { stadium: "Rose Bowl", city: "Los Angeles", country: "USA" },
  537376: { stadium: "AT&T Stadium", city: "Dallas", country: "USA" },
  537377: { stadium: "MetLife Stadium", city: "New York", country: "USA" },
  537378: { stadium: "Hard Rock Stadium", city: "Miami", country: "USA" },
  537379: { stadium: "SoFi Stadium", city: "Los Angeles", country: "USA" },
  537380: { stadium: "NRG Stadium", city: "Houston", country: "USA" },
  537381: { stadium: "Mercedes-Benz Stadium", city: "Atlanta", country: "USA" },
  537382: { stadium: "Arrowhead Stadium", city: "Kansas City", country: "USA" },

  // Quarter Finals
  537383: { stadium: "SoFi Stadium", city: "Los Angeles", country: "USA" },
  537384: { stadium: "MetLife Stadium", city: "New York", country: "USA" },
  537385: { stadium: "AT&T Stadium", city: "Dallas", country: "USA" },
  537386: { stadium: "Hard Rock Stadium", city: "Miami", country: "USA" },

  // Semi Finals
  537387: { stadium: "AT&T Stadium", city: "Dallas", country: "USA" },
  537388: { stadium: "MetLife Stadium", city: "New York", country: "USA" },

  // Third Place
  537389: { stadium: "Hard Rock Stadium", city: "Miami", country: "USA" },

  // Final
  537390: { stadium: "MetLife Stadium", city: "New York/NJ", country: "USA" },
};

export function getVenue(matchId: number): Venue | null {
  return matchVenues[matchId] || null;
}
