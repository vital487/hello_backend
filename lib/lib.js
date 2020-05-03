exports.brightnessByColor = function brightnessByColor(color) {
    color = "" + color;
    let isHEX = color.indexOf("#") === 0, isRGB = color.indexOf("rgb") === 0, r, g, b;
    if (isHEX) {
        const hasFullSpec = color.length === 7;
        let m = color.substr(1).match(hasFullSpec ? /(\S{2})/g : /(\S{1})/g);
        if (m) {
            r = parseInt(m[0] + (hasFullSpec ? '' : m[0]), 16);
            g = parseInt(m[1] + (hasFullSpec ? '' : m[1]), 16);
            b = parseInt(m[2] + (hasFullSpec ? '' : m[2]), 16);
        }
    }
    if (isRGB) {
        var m = color.match(/(\d+){3}/g);
        if (m) {
            r = m[0];
            g = m[1];
            b = m[2];
        }
    }
    if (typeof r != "undefined") return ((r * 299) + (g * 587) + (b * 114)) / 1000;
}

/**
 * Torna uma cor mais clara ou mais escura
 * @param {*} hex cor em hexadecimal
 * @param {*} lum valores vão de -1 a 1. -1 é mais escuro e 1 é mais claro
 */
exports.modifyColor = function modifyColor(hex, lum) {
    // validate hex string
    hex = String(hex).replace(/[^0-9a-f]/gi, '');
    if (hex.length < 6) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    lum = lum || 0;
    // convert to decimal and change luminosity
    var rgb = "#", c, i;
    for (i = 0; i < 3; i++) {
        c = parseInt(hex.substr(i * 2, 2), 16);
        c = Math.round(Math.min(Math.max(0, c + (c * lum)), 255)).toString(16);
        rgb += ("00" + c).substr(c.length);
    }
    return rgb;
}

/**
 * Retorna objeto com day, month e year.
 */
exports.unixToDate = function unixToDate(unix) {
    let obj = {};
    let date = new Date(unix);
    obj.day = date.getDate();
    obj.month = date.getMonth() + 1;
    obj.year = date.getFullYear();
    obj.hour = date.getHours();
    obj.minutes = date.getMinutes();
    return obj;
}

exports.setCookie = function setCookie(name, value, days) {
    var expires = "";
    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/";
}

exports.getCookie = function getCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

exports.eraseCookie = function eraseCookie(name) {
    document.cookie = name + '=; Max-Age=-99999999;';
}

exports.getUnixTime = () => {
    return Math.ceil(Date.now() / 1000)
}

exports.toUnix = (year, month, day) => {
    return new Date(`${year}.${month}.${day}`).getTime() / 1000
}

exports.isValidDate = function isValidDate(year, month, day) {
    let now = Date.now();
    let date = Date.parse(`${year}-${month}-${day}`);

    if (date > now) {
        return false;
    }

    switch (month) {
        case 1:
        case 3:
        case 5:
        case 7:
        case 8:
        case 10:
        case 12:
            if (day < 1 || day > 31) {
                return false;
            }
            return true;
        case 4:
        case 6:
        case 9:
        case 11:
            if (day < 1 || day > 30) {
                return false;
            }
            return true;
        case 2:
            if (year % 4 === 0) {
                if (day < 1 || day > 29) {
                    return false;
                }
                return true;
            }
            else {
                if (day < 1 || day > 28) {
                    return false;
                }
                return true;
            }
        default:
            return false;
    }
}

exports.getDataDiff = function getDataDiff(date) {
    if (date === -62135596800000)
        return "Nunca";

    let diffTime = Math.abs(date - Date.now());

    let diffSecs = Math.ceil(diffTime / 1000);

    if (diffSecs < 60)
        return "há " + diffSecs + " segundos"
    else {
        let diffMins = Math.ceil(diffSecs / 60);
        if (diffMins < 60)
            return "há " + diffMins + " minutos";
        else {
            let diffHours = Math.ceil(diffMins / 60);
            if (diffHours < 24)
                return "há " + diffHours + " horas";
            else {
                let diffDays = Math.ceil(diffHours / 24);
                if (diffDays < 24)
                    return "há " + diffDays + " dias";
                else {
                    let diffWeeks = Math.ceil(diffDays / 7);
                    if (diffWeeks < 24)
                        return "há " + diffWeeks + " semanas";
                    else {
                        let diffYears = Math.ceil(diffWeeks / 365);
                        return "há " + diffYears + " anos";
                    }
                }
            }
        }
    }
}

exports.updateUserLastActionTime = (db, id) => {
    let unixTime = Date.now() / 1000
    let sql = 'update users set last_update = ? where id = ?'

    db.query(sql, [unixTime, id], (err, result) => { })
}