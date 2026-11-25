// Deterministic curated U-21 wonderkid generator producing 165+ realistic FM27 wonderkids
import { ALL_49_ATTRIBUTES, GK_11_ATTRIBUTES, POSITION_14_KEYS } from "./v27-catalog-builders.mjs";

const ARCHETYPE_WEIGHTS = {
  GK: {
    reflexes: 4,
    handling: 3,
    one_on_ones: 3,
    positioning: 3,
    command_of_area: 2,
    aerial_reach: 2,
    kicking: 3,
    passing: 2,
    composure: 2,
    concentration: 2,
    anticipation: 2,
    agility: 2,
  },
  DC_BALL: {
    marking: 3,
    tackling: 3,
    positioning: 3,
    jumping_reach: 3,
    heading: 2,
    strength: 3,
    passing: 3,
    composure: 3,
    vision: 2,
    first_touch: 2,
    pace: 2,
    anticipation: 3,
  },
  DC_STOP: {
    marking: 4,
    tackling: 4,
    positioning: 3,
    jumping_reach: 4,
    heading: 3,
    strength: 4,
    bravery: 3,
    aggression: 3,
    concentration: 2,
    pace: 2,
  },
  FB_WB: {
    crossing: 3,
    pace: 3,
    acceleration: 3,
    stamina: 4,
    work_rate: 3,
    tackling: 3,
    positioning: 2,
    dribbling: 2,
    passing: 2,
    off_the_ball: 2,
    teamwork: 2,
  },
  IFB: {
    tackling: 3,
    positioning: 3,
    marking: 3,
    passing: 3,
    decisions: 3,
    composure: 3,
    first_touch: 2,
    stamina: 2,
    anticipation: 3,
  },
  DM_ANCHOR: {
    positioning: 4,
    tackling: 4,
    anticipation: 3,
    concentration: 3,
    teamwork: 3,
    work_rate: 3,
    passing: 2,
    composure: 3,
    stamina: 3,
    strength: 2,
  },
  DLP: {
    passing: 4,
    vision: 4,
    first_touch: 4,
    composure: 4,
    decisions: 3,
    technique: 4,
    positioning: 2,
    teamwork: 2,
    balance: 2,
  },
  B2B: {
    stamina: 4,
    work_rate: 4,
    passing: 3,
    tackling: 3,
    off_the_ball: 3,
    decisions: 2,
    first_touch: 2,
    acceleration: 2,
    pace: 2,
    determination: 3,
  },
  AP_AM: {
    passing: 4,
    vision: 4,
    technique: 4,
    first_touch: 4,
    dribbling: 3,
    flair: 4,
    agility: 3,
    off_the_ball: 3,
    decisions: 3,
    composure: 3,
  },
  WINGER_IF: {
    dribbling: 4,
    acceleration: 4,
    pace: 4,
    agility: 4,
    flair: 3,
    off_the_ball: 3,
    finishing: 3,
    crossing: 3,
    technique: 3,
    composure: 2,
  },
  CF_COMPLETE: {
    finishing: 4,
    off_the_ball: 4,
    composure: 3,
    first_touch: 3,
    acceleration: 3,
    pace: 3,
    dribbling: 2,
    anticipation: 3,
    heading: 2,
    strength: 2,
  },
  TARGET_ST: {
    jumping_reach: 4,
    heading: 4,
    strength: 4,
    finishing: 3,
    bravery: 3,
    balance: 3,
    off_the_ball: 3,
    first_touch: 2,
    composure: 2,
  },
};

// [name, age, club, nationality, positions, foot, priceM, paRange, ca, archetype]
const CURATED_WONDERKIDS = [
  // Goalkeepers (14)
  ["Guillaume Restes", 21, "Toulouse", "France", ["GK"], "Left", 28, "160-190", 142, "GK"],
  ["Dennis Seimen", 20, "VfB Stuttgart", "Germany", ["GK"], "Right", 19, "160-190", 132, "GK"],
  ["Rome-Jayden Owusu-Oduro", 21, "AZ Alkmaar", "Netherlands", ["GK"], "Right", 15, "150-180", 134, "GK"],
  ["Mike Penders", 21, "Chelsea", "Belgium", ["GK"], "Right", 22, "160-190", 133, "GK"],
  ["Diego Kochen", 20, "FC Barcelona", "USA", ["GK"], "Right", 11, "155-185", 122, "GK"],
  ["Alessandro Nunziante", 19, "Benevento", "Italy", ["GK"], "Right", 6.5, "155-185", 116, "GK"],
  ["Spike Brits", 19, "Man City", "England", ["GK"], "Right", 8, "150-180", 115, "GK"],
  ["Max Schmitt", 20, "FC Bayern", "Germany", ["GK"], "Right", 9, "150-180", 119, "GK"],
  ["Aron Yaakobishvili", 20, "FC Barcelona", "Hungary", ["GK"], "Right", 7.5, "150-180", 120, "GK"],
  ["Tommy Setford", 20, "Arsenal", "England", ["GK"], "Right", 10, "150-180", 121, "GK"],
  ["Ewen Jaouen", 20, "Reims", "France", ["GK"], "Right", 8.5, "150-180", 124, "GK"],
  ["Kornel Misciur", 19, "Liverpool", "Poland", ["GK"], "Right", 6, "145-175", 112, "GK"],
  ["Matthieu Epolo", 21, "Standard Liege", "Belgium", ["GK"], "Right", 9.5, "150-180", 128, "GK"],
  ["Martin Turk", 21, "Ruch Chorzow", "Slovenia", ["GK"], "Left", 4.5, "145-175", 118, "GK"],

  // Centre-Backs (26)
  ["Pau Cubarsi", 19, "FC Barcelona", "Spain", ["DC"], "Right", 85, "170-200", 156, "DC_BALL"],
  ["Leny Yoro", 21, "Man UFC", "France", ["DC"], "Right", 68, "170-200", 150, "DC_BALL"],
  ["Jorrel Hato", 20, "Ajax", "Netherlands", ["DC", "DL"], "Left", 52, "160-190", 146, "DC_BALL"],
  ["Dean Huijsen", 21, "Bournemouth", "Spain", ["DC"], "Either", 46, "160-190", 145, "DC_BALL"],
  ["Vitor Reis", 20, "Man City", "Brazil", ["DC", "DR"], "Right", 38, "160-190", 136, "DC_BALL"],
  ["Luka Vuskovic", 19, "Tottenham", "Croatia", ["DC"], "Right", 29, "160-190", 131, "DC_STOP"],
  ["Cristhian Mosquera", 21, "Valencia", "Spain", ["DC", "DR"], "Right", 34, "155-185", 141, "DC_STOP"],
  ["Pietro Comuzzo", 21, "Fiorentina", "Italy", ["DC"], "Right", 27, "155-185", 138, "DC_STOP"],
  ["Finn Jeltsch", 20, "VfB Stuttgart", "Germany", ["DC", "DM"], "Right", 22, "160-190", 131, "DC_BALL"],
  ["Aaron Anselmino", 21, "Chelsea", "Argentina", ["DC"], "Right", 24, "155-185", 132, "DC_BALL"],
  ["Abdukodir Khusanov", 21, "Man City", "Uzbekistan", ["DC"], "Right", 36, "155-185", 140, "DC_STOP"],
  ["Willy Kambwala", 21, "Villarreal", "France", ["DC"], "Right", 16, "150-180", 129, "DC_STOP"],
  ["Juma Bah", 20, "Man City", "Sierra Leone", ["DC"], "Right", 18, "155-185", 128, "DC_STOP"],
  ["Tobias Ramirez", 20, "Argentinos Juniors", "Argentina", ["DC"], "Right", 9.5, "155-185", 124, "DC_BALL"],
  ["Yarek Gasiorowski", 21, "Valencia", "Spain", ["DC", "DL"], "Left", 21, "155-185", 134, "DC_BALL"],
  ["Giovanni Leoni", 19, "Parma", "Italy", ["DC"], "Right", 16, "160-190", 126, "DC_STOP"],
  ["Mamadou Sarr", 21, "Strasbourg", "France", ["DC"], "Right", 19, "155-185", 133, "DC_BALL"],
  ["Joane Gadou", 19, "RB Salzburg", "France", ["DC"], "Right", 15, "160-190", 123, "DC_BALL"],
  ["Bastian Meupiyou", 20, "Wolves", "France", ["DC"], "Left", 11, "150-180", 121, "DC_STOP"],
  ["Kota Takai", 21, "Kawasaki Frontale", "Japan", ["DC"], "Right", 6.5, "150-180", 124, "DC_BALL"],
  ["Filippo Mane", 21, "Borussia Dortmund", "Italy", ["DC", "DR"], "Right", 10, "150-180", 122, "DC_STOP"],
  ["Karim Coulibaly", 19, "Werder Bremen", "Germany", ["DC", "DL"], "Left", 8, "155-185", 118, "DC_BALL"],
  ["Valentin Gomez", 21, "Velez Sarsfield", "Argentina", ["DC", "DL"], "Left", 14, "155-185", 134, "DC_BALL"],
  ["Nils Zatterstrom", 21, "Malmo FF", "Sweden", ["DC"], "Left", 7, "150-180", 123, "DC_BALL"],
  ["Jair Cunha", 21, "Botafogo", "Brazil", ["DC"], "Right", 15, "155-185", 130, "DC_BALL"],
  ["Saba Kharebashvili", 18, "Dinamo Tbilisi", "Georgia", ["DC", "DL"], "Left", 5.5, "155-185", 115, "DC_BALL"],

  // Full-Backs & Wing-Backs (24)
  ["Myles Lewis-Skelly", 20, "Arsenal", "England", ["DL", "DM", "MC"], "Left", 55, "160-190", 145, "IFB"],
  ["Rico Lewis", 21, "Man City", "England", ["DR", "DL", "DM"], "Right", 54, "160-190", 148, "IFB"],
  ["Geovany Quenda", 19, "Sporting CP", "Portugal", ["WBR", "AMR", "MR"], "Left", 58, "170-200", 144, "FB_WB"],
  ["Patrick Dorgu", 21, "Man UFC", "Denmark", ["DL", "WBL", "AML"], "Left", 42, "160-190", 141, "FB_WB"],
  ["Lewis Hall", 21, "Newcastle", "England", ["DL", "WBL", "MC"], "Left", 44, "160-190", 144, "FB_WB"],
  ["Martim Fernandes", 20, "FC Porto", "Portugal", ["DR", "WBR"], "Right", 28, "160-190", 136, "FB_WB"],
  ["Josh Acheampong", 20, "Chelsea", "England", ["DR", "DC"], "Right", 24, "160-190", 131, "IFB"],
  ["Hector Fort", 20, "FC Barcelona", "Spain", ["DR", "DL"], "Right", 22, "155-185", 132, "IFB"],
  ["Givairo Read", 20, "Feyenoord", "Netherlands", ["DR", "WBR"], "Right", 19, "155-185", 131, "FB_WB"],
  ["Pedro Lima", 20, "Wolves", "Brazil", ["DR", "WBR"], "Right", 17, "155-185", 127, "FB_WB"],
  ["Julio Soler", 21, "Bournemouth", "Argentina", ["DL", "WBL"], "Left", 18, "155-185", 131, "FB_WB"],
  ["Harry Amass", 19, "Man UFC", "England", ["DL", "WBL"], "Left", 14, "155-185", 121, "FB_WB"],
  ["Diego Leon", 19, "Man UFC", "Paraguay", ["DL", "WBL"], "Left", 12, "155-185", 122, "FB_WB"],
  ["Alex Jimenez", 21, "AC Milan", "Spain", ["DR", "DL", "WBR"], "Right", 20, "155-185", 133, "FB_WB"],
  ["Marco Palestra", 21, "Atalanta", "Italy", ["WBR", "DR", "MR"], "Right", 16, "150-180", 130, "FB_WB"],
  ["Davide Bartesaghi", 20, "AC Milan", "Italy", ["DL", "DC"], "Left", 11, "150-180", 123, "IFB"],
  ["Wesley Franca", 21, "Flamengo", "Brazil", ["DR", "WBR"], "Right", 25, "155-185", 137, "FB_WB"],
  ["JP Chermont", 20, "Santos", "Brazil", ["DR", "WBR"], "Right", 12, "155-185", 125, "FB_WB"],
  ["Souza", 20, "Santos", "Brazil", ["DL", "WBL"], "Left", 10, "155-185", 123, "FB_WB"],
  ["Adam Aznou", 20, "FC Bayern", "Morocco", ["DL", "WBL", "AML"], "Right", 14, "155-185", 125, "FB_WB"],
  ["Matteo Dams", 21, "Al-Ahli", "Belgium", ["DL", "DC"], "Left", 13, "150-180", 127, "IFB"],
  ["Saell Kumbedi", 21, "Lyon", "France", ["DR", "WBR"], "Right", 16, "150-180", 131, "FB_WB"],
  ["Keita Kosugi", 20, "Djurgardens", "Japan", ["DL", "WBL"], "Left", 6, "150-180", 121, "FB_WB"],
  ["Christian McFarlane", 19, "Man City", "England", ["DL", "WBL"], "Left", 8.5, "150-180", 117, "FB_WB"],

  // Defensive & Central Midfielders (34)
  ["Warren Zaire-Emery", 20, "PSG", "France", ["MC", "DM"], "Right", 82, "170-200", 156, "B2B"],
  ["Joao Neves", 21, "PSG", "Portugal", ["DM", "MC"], "Right", 88, "170-200", 160, "DLP"],
  ["Kobbie Mainoo", 21, "Man UFC", "England", ["MC", "DM"], "Right", 68, "160-190", 149, "DLP"],
  ["Marc Bernal", 19, "FC Barcelona", "Spain", ["DM", "MC"], "Left", 38, "160-190", 136, "DM_ANCHOR"],
  ["Aleksandar Pavlovic", 21, "FC Bayern", "Germany", ["DM", "MC"], "Either", 58, "160-190", 150, "DLP"],
  ["Archie Gray", 20, "Tottenham", "England", ["DM", "MC", "DR", "DC"], "Right", 46, "160-190", 141, "B2B"],
  ["Lucas Bergvall", 20, "Tottenham", "Sweden", ["MC", "AMC", "DM"], "Right", 42, "160-190", 140, "DLP"],
  ["Ayyoub Bouaddi", 19, "Lille", "France", ["DM", "MC"], "Right", 40, "170-200", 138, "DLP"],
  ["Sverre Nypan", 19, "Rosenborg", "Norway", ["MC", "AMC"], "Either", 24, "160-190", 133, "AP_AM"],
  ["Adam Wharton", 21, "Crystal Palace", "England", ["DM", "MC"], "Left", 60, "160-190", 148, "DLP"],
  ["Carlos Baleba", 21, "Brighton", "Cameroon", ["DM", "MC"], "Left", 55, "160-190", 146, "B2B"],
  ["Romeo Lavia", 21, "Chelsea", "Belgium", ["DM", "MC"], "Right", 45, "160-190", 144, "DM_ANCHOR"],
  ["Stefan Bajcetic", 21, "Liverpool", "Spain", ["DM", "MC", "DC"], "Right", 24, "155-185", 133, "DM_ANCHOR"],
  ["Arthur Vermeeren", 21, "RB Leipzig", "Belgium", ["DM", "MC"], "Right", 28, "155-185", 138, "DLP"],
  ["Gabriel Moscardo", 21, "PSG", "Brazil", ["DM", "MC"], "Right", 22, "155-185", 132, "DM_ANCHOR"],
  ["Breno Bidon", 21, "Corinthians", "Brazil", ["MC", "DM"], "Left", 18, "155-185", 132, "DLP"],
  ["Milton Delgado", 21, "Boca Juniors", "Argentina", ["DM", "MC"], "Right", 13, "155-185", 128, "DM_ANCHOR"],
  ["Federico Redondo", 21, "Inter Miami", "Argentina", ["DM", "MC"], "Right", 15, "150-180", 130, "DLP"],
  ["Tom Bischof", 21, "FC Bayern", "Germany", ["MC", "AMC", "DM"], "Left", 30, "160-190", 140, "DLP"],
  ["Assan Ouedraogo", 20, "RB Leipzig", "Germany", ["MC", "AMC", "AML"], "Either", 22, "160-190", 130, "B2B"],
  ["Kjell Watjen", 20, "Borussia Dortmund", "Germany", ["MC", "AMC"], "Right", 14, "155-185", 124, "B2B"],
  ["Noah Darvich", 20, "FC Barcelona", "Germany", ["MC", "AMC", "AMR"], "Left", 15, "155-185", 124, "AP_AM"],
  ["Chris Rigg", 19, "Sunderland", "England", ["MC", "AMC", "DM"], "Left", 26, "160-190", 131, "B2B"],
  ["Jobe Bellingham", 21, "Sunderland", "England", ["MC", "DM", "AMC"], "Right", 28, "155-185", 136, "B2B"],
  ["Kees Smit", 20, "AZ Alkmaar", "Netherlands", ["MC", "AMC"], "Right", 16, "160-190", 127, "DLP"],
  ["Antoni Milambo", 21, "Feyenoord", "Netherlands", ["MC", "AMC"], "Right", 24, "155-185", 136, "B2B"],
  ["Ezechiel Banzuzi", 21, "OH Leuven", "Netherlands", ["MC", "DM"], "Right", 14, "150-180", 129, "B2B"],
  ["Dario Essugo", 21, "Chelsea", "Portugal", ["DM", "MC"], "Right", 22, "155-185", 134, "DM_ANCHOR"],
  ["Joao Veloso", 21, "Benfica", "Portugal", ["MC", "DM"], "Right", 14, "155-185", 126, "DLP"],
  ["Valentin Atangana", 21, "Reims", "France", ["DM", "MC"], "Right", 19, "155-185", 133, "DM_ANCHOR"],
  ["Senny Mayulu", 20, "PSG", "France", ["MC", "AMC"], "Either", 24, "160-190", 132, "AP_AM"],
  ["Trey Nyoni", 19, "Liverpool", "England", ["MC", "AMC", "DM"], "Right", 15, "160-190", 121, "DLP"],
  ["Jack Hinshelwood", 21, "Brighton", "England", ["DM", "MC", "DR"], "Right", 32, "155-185", 139, "B2B"],
  ["Nico O'Reilly", 21, "Man City", "England", ["MC", "AMC", "DL"], "Left", 24, "155-185", 132, "B2B"],

  // Attacking Midfielders & Playmakers (22)
  ["Arda Guler", 21, "Real Madrid", "Turkey", ["AMC", "AMR", "MC"], "Left", 65, "170-200", 152, "AP_AM"],
  ["Claudio Echeverri", 20, "Man City", "Argentina", ["AMC", "AML"], "Right", 35, "160-190", 136, "AP_AM"],
  ["Franco Mastantuono", 19, "River Plate", "Argentina", ["AMC", "AMR", "MC"], "Left", 38, "170-200", 137, "AP_AM"],
  ["Ethan Nwaneri", 19, "Arsenal", "England", ["AMC", "AMR", "MC"], "Left", 55, "170-200", 143, "AP_AM"],
  ["Max Dowman", 17, "Arsenal", "England", ["AMC", "AMR", "MC"], "Left", 25, "170-200", 118, "AP_AM"],
  ["Kendry Paez", 19, "Chelsea", "Ecuador", ["AMC", "AMR", "MC"], "Left", 30, "160-190", 133, "AP_AM"],
  ["Rodrigo Mora", 19, "FC Porto", "Portugal", ["AMC", "AMR", "AML"], "Right", 36, "170-200", 138, "AP_AM"],
  ["Paul Wanner", 20, "FC Bayern", "Germany", ["AMC", "AMR", "MC"], "Left", 28, "160-190", 136, "AP_AM"],
  ["Can Uzun", 21, "Eintracht Frankfurt", "Turkey", ["AMC", "STC"], "Right", 26, "155-185", 136, "AP_AM"],
  ["Nico Paz", 21, "Como", "Argentina", ["AMC", "MC"], "Left", 38, "160-190", 145, "AP_AM"],
  ["Bilal El Khannouss", 21, "Leicester", "Morocco", ["AMC", "MC", "AML"], "Right", 29, "155-185", 139, "AP_AM"],
  ["Simone Pafundi", 20, "Udinese", "Italy", ["AMC", "AMR"], "Left", 14, "155-185", 125, "AP_AM"],
  ["Mattia Liberali", 19, "AC Milan", "Italy", ["AMC", "AMR"], "Left", 12, "160-190", 120, "AP_AM"],
  ["Guille Fernandez", 18, "FC Barcelona", "Spain", ["AMC", "MC"], "Right", 16, "160-190", 121, "AP_AM"],
  ["Toni Fernandez", 18, "FC Barcelona", "Spain", ["AMC", "AMR", "STC"], "Left", 16, "160-190", 120, "AP_AM"],
  ["Alvaro Montoro", 19, "Velez Sarsfield", "Argentina", ["AMC", "MC"], "Right", 11, "155-185", 122, "AP_AM"],
  ["Lorran", 20, "Flamengo", "Brazil", ["AMC", "AMR"], "Left", 17, "155-185", 127, "AP_AM"],
  [" Konstantinos Karetsas", 19, "Genk", "Greece", ["AMC", "AMR"], "Left", 24, "160-190", 132, "AP_AM"],
  ["Andrija Maksimovic", 19, "Red Star Belgrade", "Serbia", ["AMC", "MC", "AMR"], "Left", 18, "160-190", 128, "AP_AM"],
  ["Vasilije Adzic", 20, "Juventus", "Montenegro", ["AMC", "MC", "AML"], "Right", 15, "155-185", 126, "AP_AM"],
  ["Oscar Gloukh", 21, "RB Salzburg", "Israel", ["AMC", "AML"], "Either", 32, "155-185", 142, "AP_AM"],
  ["Martin Baturina", 21, "Dinamo Zagreb", "Croatia", ["AMC", "MC"], "Right", 28, "155-185", 141, "AP_AM"],

  // Wingers & Inside Forwards (25)
  ["Lamine Yamal", 19, "FC Barcelona", "Spain", ["AMR", "AML"], "Left", 165, "170-200", 172, "WINGER_IF"],
  ["Estevao", 19, "Chelsea", "Brazil", ["AMR", "AMC"], "Left", 62, "170-200", 146, "WINGER_IF"],
  ["Desire Doue", 21, "PSG", "France", ["AML", "AMR", "AMC", "MC"], "Right", 68, "170-200", 152, "WINGER_IF"],
  ["Kenan Yildiz", 21, "Juventus", "Turkey", ["AML", "AMC", "STC"], "Either", 60, "160-190", 150, "WINGER_IF"],
  ["Savinho", 21, "Man City", "Brazil", ["AMR", "AML"], "Left", 62, "160-190", 151, "WINGER_IF"],
  ["Yankuba Minteh", 21, "Brighton", "Gambia", ["AMR", "MR"], "Left", 38, "155-185", 141, "WINGER_IF"],
  ["Jamie Gittens", 21, "Borussia Dortmund", "England", ["AML", "AMR"], "Right", 54, "160-190", 147, "WINGER_IF"],
  ["Malick Fofana", 21, "Lyon", "Belgium", ["AML", "AMR"], "Right", 34, "155-185", 140, "WINGER_IF"],
  ["Assane Diao", 21, "Como", "Spain", ["AMR", "AML", "STC"], "Right", 26, "155-185", 136, "WINGER_IF"],
  ["Antonio Nusa", 21, "RB Leipzig", "Norway", ["AML", "ML", "AMR"], "Right", 32, "160-190", 139, "WINGER_IF"],
  ["Ben Doak", 21, "Liverpool", "Scotland", ["AMR", "MR"], "Right", 24, "155-185", 134, "WINGER_IF"],
  ["Tyler Dibling", 20, "Southampton", "England", ["AMR", "AMC", "MR"], "Left", 38, "160-190", 137, "WINGER_IF"],
  ["Mikey Moore", 19, "Tottenham", "England", ["AML", "AMC", "AMR"], "Right", 28, "160-190", 129, "WINGER_IF"],
  ["Rio Ngumoha", 18, "Liverpool", "England", ["AML", "AMC"], "Right", 18, "160-190", 119, "WINGER_IF"],
  ["Shea Lacey", 19, "Man UFC", "England", ["AMR", "AMC"], "Left", 14, "155-185", 120, "WINGER_IF"],
  ["Julien Duranville", 20, "Borussia Dortmund", "Belgium", ["AMR", "AML"], "Right", 25, "160-190", 132, "WINGER_IF"],
  ["Roony Bardghji", 21, "FC Copenhagen", "Sweden", ["AMR"], "Left", 19, "155-185", 133, "WINGER_IF"],
  ["Ibrahim Mbaye", 18, "PSG", "France", ["AMR", "AML"], "Right", 20, "160-190", 124, "WINGER_IF"],
  ["Eliesse Ben Seghir", 21, "AS Monaco", "Morocco", ["AML", "AMC"], "Right", 36, "160-190", 143, "WINGER_IF"],
  ["Maghnes Akliouche", 21, "AS Monaco", "France", ["AMR", "AMC"], "Left", 42, "160-190", 145, "AP_AM"],
  ["Jesus Rodriguez", 20, "Real Betis", "Spain", ["AML", "AMR"], "Right", 22, "155-185", 132, "WINGER_IF"],
  ["Gianluca Prestianni", 20, "Benfica", "Argentina", ["AMR", "AML", "AMC"], "Right", 20, "160-190", 130, "WINGER_IF"],
  ["Roger Fernandes", 20, "SC Braga", "Portugal", ["AMR", "AML", "WBR"], "Left", 24, "160-190", 135, "WINGER_IF"],
  ["Leo Sauer", 20, "Feyenoord", "Slovakia", ["AML"], "Right", 14, "150-180", 126, "WINGER_IF"],
  ["Riquelme Fillipi", 20, "Palmeiras", "Brazil", ["AML", "AMR"], "Right", 13, "155-185", 124, "WINGER_IF"],

  // Strikers & Centre-Forwards (24)
  ["Endrick", 20, "Real Madrid", "Brazil", ["STC", "AMR"], "Left", 65, "170-200", 148, "CF_COMPLETE"],
  ["Mathys Tel", 21, "FC Bayern", "France", ["STC", "AML", "AMR"], "Right", 45, "160-190", 143, "CF_COMPLETE"],
  ["Samu Aghehowa", 21, "FC Porto", "Spain", ["STC"], "Right", 52, "160-190", 147, "TARGET_ST"],
  ["Evan Ferguson", 21, "Brighton", "Ireland", ["STC"], "Right", 40, "160-190", 141, "TARGET_ST"],
  ["Vitor Roque", 21, "Palmeiras", "Brazil", ["STC", "AMR", "AML"], "Right", 30, "155-185", 138, "CF_COMPLETE"],
  ["Francesco Camarda", 18, "AC Milan", "Italy", ["STC"], "Right", 28, "170-200", 125, "CF_COMPLETE"],
  ["Chido Obi", 18, "Man UFC", "Denmark", ["STC"], "Right", 20, "160-190", 121, "TARGET_ST"],
  ["Marc Guiu", 20, "Chelsea", "Spain", ["STC"], "Right", 22, "155-185", 131, "TARGET_ST"],
  ["Eli Junior Kroupi", 20, "Bournemouth", "France", ["STC", "AMC", "AML"], "Right", 26, "160-190", 135, "CF_COMPLETE"],
  ["George Ilenikhena", 20, "AS Monaco", "France", ["STC"], "Left", 28, "160-190", 134, "CF_COMPLETE"],
  ["Conrad Harder", 21, "Sporting CP", "Denmark", ["STC"], "Left", 26, "155-185", 136, "TARGET_ST"],
  ["Stefanos Tzimas", 20, "Brighton", "Greece", ["STC"], "Either", 25, "160-190", 132, "CF_COMPLETE"],
  ["Charalampos Kostoulas", 19, "Olympiacos", "Greece", ["STC", "AMC"], "Right", 22, "160-190", 130, "CF_COMPLETE"],
  ["Nelson Weiper", 21, "Mainz 05", "Germany", ["STC"], "Right", 14, "155-185", 127, "TARGET_ST"],
  ["Paris Brunner", 20, "AS Monaco", "Germany", ["STC", "AML"], "Right", 16, "155-185", 125, "CF_COMPLETE"],
  ["Karim Konate", 21, "RB Salzburg", "Ivory Coast", ["STC"], "Right", 24, "155-185", 136, "CF_COMPLETE"],
  ["Agustin Ruberto", 20, "River Plate", "Argentina", ["STC"], "Right", 15, "155-185", 126, "CF_COMPLETE"],
  ["Santiago Castro", 21, "Bologna", "Argentina", ["STC"], "Right", 32, "155-185", 141, "CF_COMPLETE"],
  ["Jhon Duran", 21, "Al-Nassr", "Colombia", ["STC"], "Left", 50, "160-190", 147, "TARGET_ST"],
  ["Semih Kilicsoy", 21, "Besiktas", "Turkey", ["STC", "AML"], "Right", 22, "155-185", 135, "CF_COMPLETE"],
  ["Kauã Elias", 20, "Shakhtar Donetsk", "Brazil", ["STC"], "Right", 18, "155-185", 129, "CF_COMPLETE"],
  ["Rory Wilson", 20, "Aston Villa", "Scotland", ["STC"], "Right", 11, "150-180", 122, "CF_COMPLETE"],
  ["Jayden Danns", 20, "Liverpool", "England", ["STC"], "Right", 15, "155-185", 125, "CF_COMPLETE"],
  ["Ethan Wheatley", 20, "Man UFC", "England", ["STC"], "Right", 10, "150-180", 120, "TARGET_ST"],

  // Additional Global U-21 Gems to reach 165 entries (20)
  ["Lennart Karl", 18, "FC Bayern", "Germany", ["AMC", "AMR"], "Left", 16, "160-190", 120, "AP_AM"],
  ["Wisdom Mike", 18, "FC Bayern", "Germany", ["AML", "AMR", "STC"], "Right", 14, "160-190", 118, "WINGER_IF"],
  ["Cavan Sullivan", 17, "Philadelphia Union", "USA", ["AMC", "AMR", "AML"], "Left", 18, "160-190", 116, "AP_AM"],
  ["Nimfasha Berchimas", 18, "Charlotte FC", "USA", ["AML", "AMR"], "Right", 9, "155-185", 116, "WINGER_IF"],
  ["Gilberto Mora", 18, "Club Tijuana", "Mexico", ["AMC", "MC"], "Right", 11, "160-190", 120, "AP_AM"],
  ["Obed Vargas", 21, "Seattle Sounders", "Mexico", ["MC", "DM"], "Right", 9.5, "150-180", 127, "B2B"],
  ["Yang Min-hyeok", 20, "Tottenham", "South Korea", ["AMR", "AML"], "Right", 15, "155-185", 126, "WINGER_IF"],
  ["Yoon Do-young", 20, "Brighton", "South Korea", ["AMR", "AMC"], "Left", 9, "150-180", 121, "WINGER_IF"],
  ["Gaku Nawata", 20, "Gamba Osaka", "Japan", ["AMC", "STC"], "Right", 6.5, "155-185", 120, "AP_AM"],
  ["Rento Takaoka", 19, "Southampton", "Japan", ["STC", "AML"], "Right", 7, "150-180", 118, "CF_COMPLETE"],
  ["Nestory Irankunda", 20, "FC Bayern", "Australia", ["AMR", "MR"], "Right", 14, "155-185", 126, "WINGER_IF"],
  ["Amara Diouf", 18, "Generation Foot", "Senegal", ["AML", "AMR", "STC"], "Right", 12, "160-190", 119, "WINGER_IF"],
  ["Ibrahim Osman", 21, "Brighton", "Ghana", ["AML", "AMR", "STC"], "Right", 18, "150-180", 131, "WINGER_IF"],
  ["Yankuba Ceesay", 19, "Nordsjaelland", "Gambia", ["MC", "DM"], "Right", 8, "150-180", 119, "B2B"],
  ["Sindre Walle Egeli", 20, "Nordsjaelland", "Norway", ["AMR", "STC"], "Left", 22, "160-190", 132, "WINGER_IF"],
  ["Conrad Jansson", 19, "IFK Goteborg", "Sweden", ["MC", "AMC"], "Right", 6, "150-180", 118, "DLP"],
  ["Luka Topalovic", 20, "Inter", "Slovenia", ["AMC", "MC"], "Right", 10, "155-185", 123, "AP_AM"],
  ["Matija Popovic", 20, "Napoli", "Serbia", ["AMC", "AML", "STC"], "Right", 11, "155-185", 122, "AP_AM"],
  ["Jovan Milosevic", 21, "VfB Stuttgart", "Serbia", ["STC"], "Right", 9.5, "150-180", 124, "CF_COMPLETE"],
  ["Arkadiusz Pyrka", 21, "Piast Gliwice", "Poland", ["WBR", "DR", "MR"], "Right", 6.5, "145-175", 123, "FB_WB"],
];

function deterministicNoise(seed, idx) {
  const x = Math.sin(seed * 97.13 + idx * 31.7) * 10000;
  return x - Math.floor(x); // 0..1
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, Math.round(val)));
}

export function buildWonderkidsSeed() {
  const gkSet = new Set(GK_11_ATTRIBUTES);

  const Wonderkids = CURATED_WONDERKIDS.map((row, idx) => {
    const [
      rawName,
      age,
      club,
      nationality,
      positions,
      preferredFoot,
      estimatedPriceEurM,
      paRange,
      currentAbilityEstimate,
      archetype,
    ] = row;
    const name = rawName.trim();
    const uid = 2700001 + idx;
    const isGk = archetype === "GK";
    const baseLevel = (currentAbilityEstimate / 200) * 14.5 + 3.0; // ~11..15.5 base
    const weights = ARCHETYPE_WEIGHTS[archetype] ?? ARCHETYPE_WEIGHTS.B2B;

    const attributes = {};
    ALL_49_ATTRIBUTES.forEach((attr, attrIdx) => {
      const noise = (deterministicNoise(uid, attrIdx) - 0.5) * 2.4;
      const isGkAttr = gkSet.has(attr);

      if (attr === "dirtiness") {
        attributes[attr] = clamp(5 + deterministicNoise(uid, attrIdx) * 7, 2, 14);
        return;
      }
      if (attr === "injury_proneness") {
        attributes[attr] = clamp(4 + deterministicNoise(uid, attrIdx) * 7, 2, 13);
        return;
      }
      if (attr === "eccentricity") {
        attributes[attr] = isGk
          ? clamp(4 + deterministicNoise(uid, attrIdx) * 8, 2, 14)
          : clamp(1 + deterministicNoise(uid, attrIdx) * 3, 1, 5);
        return;
      }

      if (isGk !== isGkAttr && attr !== "kicking" && attr !== "passing" && attr !== "first_touch") {
        if (isGk && ["determination", "work_rate", "teamwork", "decisions", "composure", "concentration", "anticipation", "positioning", "agility", "acceleration", "strength", "jumping_reach", "natural_fitness", "stamina", "balance", "leadership", "bravery"].includes(attr)) {
          const w = weights[attr] ?? 0;
          attributes[attr] = clamp(baseLevel - 1.2 + w * 0.9 + noise, 7, 19);
        } else {
          attributes[attr] = clamp(2 + deterministicNoise(uid, attrIdx) * 4, 1, 7);
        }
        return;
      }

      const w = weights[attr] ?? 0;
      const raw = baseLevel - 1.5 + w * 1.05 + noise;
      attributes[attr] = clamp(raw, 6, 19);
    });

    const positionFamiliarity = {};
    POSITION_14_KEYS.forEach((pos) => {
      const primaryIdx = positions.indexOf(pos);
      if (primaryIdx === 0) {
        positionFamiliarity[pos] = 20;
      } else if (primaryIdx === 1) {
        positionFamiliarity[pos] = 17;
      } else if (primaryIdx >= 2) {
        positionFamiliarity[pos] = 15;
      } else if (pos === "WBR" && positions.includes("DR")) {
        positionFamiliarity[pos] = 14;
      } else if (pos === "WBL" && positions.includes("DL")) {
        positionFamiliarity[pos] = 14;
      } else if (pos === "ML" && positions.includes("AML")) {
        positionFamiliarity[pos] = 13;
      } else if (pos === "MR" && positions.includes("AMR")) {
        positionFamiliarity[pos] = 13;
      } else {
        positionFamiliarity[pos] = 1;
      }
    });

    const leftFoot =
      preferredFoot === "Left" ? 20 : preferredFoot === "Either" ? 17 : clamp(8 + deterministicNoise(uid, 99) * 6, 6, 14);
    const rightFoot =
      preferredFoot === "Right" ? 20 : preferredFoot === "Either" ? 18 : clamp(8 + deterministicNoise(uid, 98) * 6, 6, 14);

    return {
      uid,
      name,
      age,
      club,
      nationality,
      positions,
      preferredFoot,
      leftFoot,
      rightFoot,
      estimatedPriceEurM,
      paRange,
      currentAbilityEstimate,
      attributes,
      positionFamiliarity,
      isCurated: true,
    };
  });

  return { Wonderkids };
}
