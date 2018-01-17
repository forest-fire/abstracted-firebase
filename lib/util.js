"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function slashNotation(path) {
    return path.substr(0, 5) === ".info"
        ? path.substr(0, 5) + path.substring(5).replace(/\./g, "/")
        : path.replace(/\./g, "/");
}
exports.slashNotation = slashNotation;
