/**
 * Départements de France métropolitaine : nom et position de la préfecture.
 *
 * Sert de secours quand la base officielle des communes (scripts/geo.ts) ne répond
 * pas : la distance est alors calculée depuis la préfecture, et signalée comme
 * approximative. Sert aussi à savoir quels départements sont à portée de tes zones.
 */
import { CITIES, distanceBetween } from '../../src/data/cities'
import { STATION_REACH_KM, STATIONS } from '../../src/data/stations'
import type { TrainReach, Zone } from '../../src/types'

export const DEPARTMENTS: Record<string, [name: string, lat: number, lon: number]> = {
  '01': ['Ain', 46.2052, 5.2255],
  '02': ['Aisne', 49.5641, 3.6199],
  '03': ['Allier', 46.5646, 3.3329],
  '04': ['Alpes-de-Haute-Provence', 44.0925, 6.2356],
  '05': ['Hautes-Alpes', 44.5594, 6.0786],
  '06': ['Alpes-Maritimes', 43.7102, 7.262],
  '07': ['Ardèche', 44.7353, 4.5986],
  '08': ['Ardennes', 49.7623, 4.7266],
  '09': ['Ariège', 42.9646, 1.6052],
  '10': ['Aube', 48.2973, 4.0744],
  '11': ['Aude', 43.213, 2.3491],
  '12': ['Aveyron', 44.3506, 2.575],
  '13': ['Bouches-du-Rhône', 43.2965, 5.3698],
  '14': ['Calvados', 49.1829, -0.3707],
  '15': ['Cantal', 44.9261, 2.4399],
  '16': ['Charente', 45.6484, 0.1562],
  '17': ['Charente-Maritime', 46.1603, -1.1511],
  '18': ['Cher', 47.081, 2.3988],
  '19': ['Corrèze', 45.2671, 1.7716],
  '2A': ['Corse-du-Sud', 41.9192, 8.7386],
  '2B': ['Haute-Corse', 42.6977, 9.45],
  '21': ["Côte-d'Or", 47.322, 5.0415],
  '22': ["Côtes-d'Armor", 48.5136, -2.7603],
  '23': ['Creuse', 46.1687, 1.8715],
  '24': ['Dordogne', 45.184, 0.7211],
  '25': ['Doubs', 47.2378, 6.0241],
  '26': ['Drôme', 44.9334, 4.8924],
  '27': ['Eure', 49.027, 1.1508],
  '28': ['Eure-et-Loir', 48.4439, 1.489],
  '29': ['Finistère', 47.996, -4.1024],
  '30': ['Gard', 43.8367, 4.3601],
  '31': ['Haute-Garonne', 43.6047, 1.4442],
  '32': ['Gers', 43.6465, 0.5855],
  '33': ['Gironde', 44.8378, -0.5792],
  '34': ['Hérault', 43.6108, 3.8767],
  '35': ['Ille-et-Vilaine', 48.1173, -1.6778],
  '36': ['Indre', 46.8103, 1.6913],
  '37': ['Indre-et-Loire', 47.3941, 0.6848],
  '38': ['Isère', 45.1885, 5.7245],
  '39': ['Jura', 46.6744, 5.5539],
  '40': ['Landes', 43.8905, -0.4997],
  '41': ['Loir-et-Cher', 47.5861, 1.3359],
  '42': ['Loire', 45.4397, 4.3872],
  '43': ['Haute-Loire', 45.0428, 3.8829],
  '44': ['Loire-Atlantique', 47.2184, -1.5536],
  '45': ['Loiret', 47.9029, 1.9093],
  '46': ['Lot', 44.4475, 1.4419],
  '47': ['Lot-et-Garonne', 44.2033, 0.6163],
  '48': ['Lozère', 44.5181, 3.5016],
  '49': ['Maine-et-Loire', 47.4784, -0.5632],
  '50': ['Manche', 49.1157, -1.0906],
  '51': ['Marne', 48.9566, 4.3631],
  '52': ['Haute-Marne', 48.1113, 5.1392],
  '53': ['Mayenne', 48.0707, -0.7734],
  '54': ['Meurthe-et-Moselle', 48.6921, 6.1844],
  '55': ['Meuse', 48.7726, 5.1619],
  '56': ['Morbihan', 47.6582, -2.7608],
  '57': ['Moselle', 49.1193, 6.1757],
  '58': ['Nièvre', 46.9908, 3.159],
  '59': ['Nord', 50.6292, 3.0573],
  '60': ['Oise', 49.4295, 2.0807],
  '61': ['Orne', 48.4329, 0.0913],
  '62': ['Pas-de-Calais', 50.291, 2.7775],
  '63': ['Puy-de-Dôme', 45.7772, 3.087],
  '64': ['Pyrénées-Atlantiques', 43.2951, -0.3708],
  '65': ['Hautes-Pyrénées', 43.2328, 0.0782],
  '66': ['Pyrénées-Orientales', 42.6887, 2.8948],
  '67': ['Bas-Rhin', 48.5734, 7.7521],
  '68': ['Haut-Rhin', 48.0794, 7.3585],
  '69': ['Rhône', 45.764, 4.8357],
  '70': ['Haute-Saône', 47.6198, 6.1543],
  '71': ['Saône-et-Loire', 46.3069, 4.8287],
  '72': ['Sarthe', 48.0061, 0.1996],
  '73': ['Savoie', 45.5646, 5.9178],
  '74': ['Haute-Savoie', 45.8992, 6.1294],
  '75': ['Paris', 48.8566, 2.3522],
  '76': ['Seine-Maritime', 49.4432, 1.0999],
  '77': ['Seine-et-Marne', 48.5421, 2.6554],
  '78': ['Yvelines', 48.8049, 2.1204],
  '79': ['Deux-Sèvres', 46.3237, -0.4588],
  '80': ['Somme', 49.8941, 2.2958],
  '81': ['Tarn', 43.9298, 2.148],
  '82': ['Tarn-et-Garonne', 44.0221, 1.3529],
  '83': ['Var', 43.1242, 5.928],
  '84': ['Vaucluse', 43.9493, 4.8055],
  '85': ['Vendée', 46.6705, -1.426],
  '86': ['Vienne', 46.5802, 0.3404],
  '87': ['Haute-Vienne', 45.8336, 1.2611],
  '88': ['Vosges', 48.1724, 6.4494],
  '89': ['Yonne', 47.7982, 3.5673],
  '90': ['Territoire de Belfort', 47.638, 6.8628],
  '91': ['Essonne', 48.6239, 2.4294],
  '92': ['Hauts-de-Seine', 48.8924, 2.2069],
  '93': ['Seine-Saint-Denis', 48.9077, 2.4386],
  '94': ['Val-de-Marne', 48.7904, 2.4556],
  '95': ["Val-d'Oise", 49.0364, 2.0761],
}

/** Code du département d'un code postal français à 5 chiffres (« 20… » = Corse), ou null. */
export function departmentCode(postal: string): string | null {
  if (!/^\d{5}$/.test(postal)) return null
  const two = postal.slice(0, 2)
  if (two === '20') return Number(postal.slice(0, 3)) <= 201 ? '2A' : '2B'
  return two in DEPARTMENTS ? two : null
}

/**
 * Départements dont la préfecture est à moins de (rayon de la zone + marge) du centre d'une
 * zone active. La marge couvre les communes d'un département voisin situées dans le rayon.
 */
export function departmentsNear(zones: Zone[], train?: TrainReach, marginKm = 80): string[] {
  const active = zones.filter((z) => z.enabled && CITIES[z.center])
  // Gares d'où le vendeur reste à portée : train + marge de 10 min sous le temps maximal.
  const stations = train?.enabled ? STATIONS.filter((s) => s.fromParis + 10 <= train.maxHours * 60) : []
  return Object.entries(DEPARTMENTS)
    .filter(
      ([, [, lat, lon]]) =>
        active.some((z) => distanceBetween(CITIES[z.center], { lat, lon }) <= z.radiusKm + marginKm) ||
        stations.some((s) => distanceBetween(s, { lat, lon }) <= STATION_REACH_KM + 50),
    )
    .map(([code]) => code)
}
