#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const FIXTURES_DIR = path.join(REPO_ROOT, "tests/fixtures");

function buildSampleSquadCsv() {
  const headers = [
    "uid",
    "name",
    "club_uid",
    "club_name",
    "team_id",
    "team_slot",
    "ability_current",
    "preferred_foot_left",
    "preferred_foot_right",
    "pos_GK",
    "pos_DL",
    "pos_DC",
    "pos_DR",
    "pos_DM",
    "pos_ML",
    "pos_MC",
    "pos_MR",
    "pos_AML",
    "pos_AMC",
    "pos_AMR",
    "pos_STC",
    "pos_WBL",
    "pos_WBR",
    "passing",
    "vision",
    "decisions",
    "first_touch",
    "composure",
    "tackling",
    "marking",
    "positioning",
    "dribbling",
    "finishing",
    "off_the_ball",
    "acceleration",
    "pace",
    "stamina",
    "work_rate",
    "strength",
    "jumping_reach",
    "heading",
    "crossing",
    "reflexes",
    "handling",
    "kicking",
  ];

  const players = [
    [1001, "David Raya", 602, "North London FC", 1, "GK", 162, 10, 20, 20, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 15, 14, 15, 14, 16, 3, 3, 16, 4, 2, 3, 13, 12, 14, 14, 13, 14, 4, 3, 17, 16, 17],
    [1002, "Aaron Backup", 602, "North London FC", 1, "S1", 138, 8, 20, 20, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 12, 11, 13, 12, 13, 2, 2, 14, 3, 2, 2, 11, 11, 12, 13, 14, 16, 3, 2, 15, 15, 14],
    [1003, "Ben White", 602, "North London FC", 1, "DR", 158, 11, 20, 1, 8, 18, 20, 12, 1, 8, 12, 1, 1, 1, 1, 4, 16, 15, 13, 15, 15, 16, 16, 15, 16, 13, 7, 13, 14, 15, 16, 16, 14, 13, 13, 14, 2, 2, 3],
    [1004, "William Saliba", 602, "North London FC", 1, "DCR", 174, 12, 20, 1, 4, 20, 8, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 15, 13, 16, 15, 18, 17, 17, 17, 13, 6, 9, 15, 17, 15, 15, 17, 16, 15, 7, 2, 2, 3],
    [1005, "Gabriel Magalhaes", 602, "North London FC", 1, "DCL", 169, 20, 9, 1, 6, 20, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 13, 11, 15, 13, 15, 17, 17, 17, 11, 9, 10, 13, 14, 15, 16, 18, 17, 17, 6, 2, 2, 3],
    [1006, "Jurrien Timber", 602, "North London FC", 1, "DL", 160, 14, 20, 1, 18, 18, 19, 12, 6, 8, 8, 1, 1, 1, 1, 15, 16, 15, 14, 15, 16, 17, 16, 15, 15, 15, 8, 13, 16, 16, 15, 16, 14, 12, 12, 13, 2, 2, 3],
    [1007, "Declan Rice", 602, "North London FC", 1, "DM", 175, 13, 20, 1, 1, 14, 1, 20, 1, 19, 1, 1, 8, 1, 1, 1, 1, 16, 15, 17, 15, 17, 18, 16, 17, 14, 11, 15, 14, 15, 19, 19, 17, 15, 14, 13, 2, 2, 3],
    [1008, "Martin Odegaard", 602, "North London FC", 1, "MCR", 178, 20, 9, 1, 1, 1, 1, 6, 6, 18, 12, 8, 20, 15, 1, 1, 1, 19, 20, 18, 19, 18, 11, 9, 12, 17, 14, 17, 14, 13, 17, 18, 10, 8, 7, 16, 2, 2, 3],
    [1009, "Mikel Merino", 602, "North London FC", 1, "MCL", 159, 20, 12, 1, 1, 6, 1, 16, 6, 20, 1, 1, 14, 1, 10, 1, 1, 15, 15, 16, 15, 16, 15, 14, 15, 13, 13, 16, 12, 12, 16, 17, 16, 16, 16, 12, 2, 2, 3],
    [1010, "Bukayo Saka", 602, "North London FC", 1, "AMR", 180, 20, 13, 1, 12, 1, 1, 1, 16, 6, 17, 15, 12, 20, 8, 14, 8, 16, 17, 17, 17, 17, 11, 9, 11, 18, 16, 18, 18, 17, 17, 17, 14, 10, 10, 17, 2, 2, 3],
    [1011, "Gabriel Martinelli", 602, "North London FC", 1, "AML", 163, 12, 20, 1, 1, 1, 1, 1, 16, 1, 12, 20, 8, 15, 15, 8, 1, 13, 13, 13, 15, 14, 10, 8, 10, 17, 15, 17, 19, 19, 17, 18, 12, 11, 12, 14, 2, 2, 3],
    [1012, "Kai Havertz", 602, "North London FC", 1, "STC", 165, 20, 14, 1, 1, 1, 1, 4, 6, 15, 8, 12, 19, 14, 20, 1, 1, 15, 15, 15, 17, 16, 11, 9, 12, 15, 14, 18, 14, 16, 17, 18, 15, 16, 16, 12, 2, 2, 3],
    [1013, "Riccardo Calafiori", 602, "North London FC", 1, "S2", 157, 20, 11, 1, 19, 19, 1, 10, 10, 8, 1, 1, 1, 1, 1, 17, 1, 15, 14, 14, 15, 16, 16, 15, 15, 14, 10, 13, 14, 15, 15, 16, 15, 15, 14, 14, 2, 2, 3],
    [1014, "Myles Lewis-Skelly", 602, "North London FC", 1, "S3", 145, 20, 11, 1, 18, 6, 1, 18, 8, 17, 1, 1, 10, 1, 1, 15, 1, 15, 14, 15, 16, 16, 15, 13, 14, 15, 8, 13, 15, 15, 15, 15, 15, 11, 10, 12, 2, 2, 3],
    [1015, "Ethan Nwaneri", 602, "North London FC", 1, "S4", 144, 20, 13, 1, 1, 1, 1, 1, 8, 15, 12, 12, 20, 18, 12, 1, 1, 15, 16, 14, 17, 16, 8, 6, 8, 17, 15, 15, 16, 15, 13, 14, 11, 8, 7, 14, 2, 2, 3],
    [1016, "Leandro Trossard", 602, "North London FC", 1, "S5", 160, 16, 20, 1, 1, 1, 1, 1, 15, 10, 12, 20, 18, 16, 16, 6, 1, 15, 15, 15, 17, 16, 8, 6, 8, 17, 16, 17, 15, 14, 14, 15, 10, 7, 8, 15, 2, 2, 3],
    [1017, "Gabriel Jesus", 602, "North London FC", 1, "S6", 158, 14, 20, 1, 1, 1, 1, 1, 10, 1, 12, 18, 12, 18, 20, 1, 1, 14, 14, 14, 17, 14, 11, 8, 9, 18, 14, 17, 17, 16, 16, 18, 13, 12, 13, 13, 2, 2, 3],
    [1018, "Thomas Anchor", 602, "North London FC", 1, "S7", 156, 12, 20, 1, 1, 10, 12, 20, 1, 18, 6, 1, 6, 1, 1, 1, 8, 16, 16, 14, 16, 16, 15, 14, 15, 15, 11, 13, 13, 13, 14, 14, 16, 14, 13, 11, 2, 2, 3],
  ];

  return [headers.join(","), ...players.map((r) => r.join(","))].join("\n") + "\n";
}

function main() {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  const squadCsvPath = path.join(FIXTURES_DIR, "sample-squad.csv");
  fs.writeFileSync(squadCsvPath, buildSampleSquadCsv(), "utf8");
  console.log(`[generate-golden-fixtures] Wrote ${path.relative(REPO_ROOT, squadCsvPath)}`);
}

main();
