const itemText = "A1099 SECTOR EL ESTADIO habitaciones :3 Banos :2 Valor: $520.000.000 Área: 87 MT2 Ubicación: Sector Estadio, Edificio Med 70 cerca a Iglesia de Lourdes Nueva Florida Piso 5 - Apto 501 Edificio de 12 niveles Ascensor Parqueadero cubierto N°14 Habitaciones 3 balcón y baño en la habitación principal baño social completo Estudio Cocina abierta Zona de ropas Balcones 2 5 años de construcción Unidad independiente Zonas comunes parqueadero de visitantes Terraza común con asador y baño Está libre de gravamen Estrato 4 Predial $755.000 trimestral Administración $380.000";

let fullText = itemText.toLowerCase().replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');

const textNums = {'un ': '1 ', 'una ': '1 ', 'dos ': '2 ', 'tres ': '3 ', 'cuatro ': '4 ', 'cinco ': '5 ', 'seis ': '6 '};
for (const [word, num] of Object.entries(textNums)) {
    fullText = fullText.replace(new RegExp(`\\b${word}`, 'g'), num);
}

const bedsMatch = fullText.match(/(\d+)\s{0,3}(?:alcobas?|habitaci[óo]n(?:es)?|habs?)\b/) || fullText.match(/(?:alcobas?|habitaci[óo]n(?:es)?|habs?)[\s:]*(\d+)/);
const beds = bedsMatch ? (bedsMatch[1] || bedsMatch[2]) : '-';

const bathsMatch = fullText.match(/(\d+)\s{0,3}ba[ñn]os?\b/) || fullText.match(/ba[ñn]os?[\s:]*(\d+)/);
const baths = bathsMatch ? (bathsMatch[1] || bathsMatch[2]) : '-';

console.log("Beds:", beds, "Baths:", baths);
