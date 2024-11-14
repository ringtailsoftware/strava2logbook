const fs = require("fs");
const { parse } = require("csv-parse");
const Promise = require("bluebird");
const request = require('request');
var convert = require('xml-js');
var path = require('path');

const EXPORTDIR='export';
const TMPDIR='tmp';
const NOTESDIR='notes';

if (!fs.existsSync(EXPORTDIR)) {
    console.log(`Strava archive directory ${EXPORTDIR} not found`);
    process.exit(1);
}

if (!fs.existsSync(TMPDIR)) {
    fs.mkdirSync(TMPDIR);
}

if (!fs.existsSync(NOTESDIR)) {
    fs.mkdirSync(NOTESDIR);
}

const USE_WEATHER = true;
const USE_MAP = true;

function parseActivities() {
    return new Promise((resolve, reject) => {

    let activities = [];    
    fs.createReadStream(EXPORTDIR + '/activities.csv')
        .pipe(parse({ delimiter: ",", from_line: 2 }))
        .on("data", function (row) {
            if (row[3] == 'Kayaking') {
                activities.push({
                    id: row[0],
                    date: row[1],
                    name: row[2],
                    desc: row[4],
                    elapsedTime: row[5],
                    distance: row[6],
                    privNote: row[10],
                    fitFile: row[12],
                    gpxFile: row[0] + '.gpx',
                    mapFile: row[0] + '.jpg',
                    media: row[93].split('|'),
                    notesFile: notesFilename(row[1])
                });
            }
        })
        .on("end", function () {
            resolve(activities);
        })
        .on("error", function (error) {
            reject(error.message);
        });
    });
}

function execShellCommand(cmd) {
    const exec = require('child_process').exec;
    return new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                console.warn(error.message);
                if (error.code != 0) {
                    reject(`${cmd} exited with code code ${error.code}`);
                }
            } else {
                resolve(stdout? stdout : stderr);
            }
        });
    });
}

function fitToGpx(fitFile, gpxFile) {
    return execShellCommand(`gpsbabel -i garmin_fit -f ${fitFile} -o gpx -F ${gpxFile}`);
}

function gpxToMap(gpxFile, mapFile) {
    return execShellCommand(`perl gpx2png.pl -b 1 ${gpxFile} -o map.png && convert -strip -interlace Plane +dither -colors 16 -quality 85% -scale 800 map.png ${mapFile} && rm -f map.png`);
}

function gpxAllToMap(gpxFiles, mapFile) {
    return execShellCommand(`perl gpx2png.pl -b 1 -o map.png ${gpxFiles.join(' ')} && convert map.png ${mapFile} && rm -f map.png`);
}

function parseGpx(gpxFile) {
    const xml = fs.readFileSync(gpxFile, { encoding: 'utf8', flag: 'r' });
    var res = JSON.parse(convert.xml2json(xml, {compact: true, spaces: 4}));
    return {
        time: res.gpx.time._text,
        lat: (parseFloat(res.gpx.bounds._attributes.minlat) + parseFloat(res.gpx.bounds._attributes.maxlat)) / 2,
        lon: (parseFloat(res.gpx.bounds._attributes.minlon) + parseFloat(res.gpx.bounds._attributes.maxlon)) / 2,
    };
}

function secondsToHm(d) {
    d = Number(d);
    var h = Math.floor(d / 3600);
    var m = Math.floor(d % 3600 / 60);
//    var s = Math.floor(d % 3600 % 60);

    var hDisplay = h > 0 ? h + (h == 1 ? " hr, " : " hrs, ") : "";
    var mDisplay = m > 0 ? m + (m == 1 ? " min" : " mins") : "";
//    var sDisplay = s > 0 ? s + (s == 1 ? " second" : " seconds") : "";
    return hDisplay + mDisplay;// + sDisplay; 
}

function kmToMi(km) {
    return km * 0.621371;
}

function renderWeather(weather, startHr, endHr) {
    let html = '';

    html += '<table>';

    html += '<tr>';
    html += '<th></th>';
    for (i=startHr;i<=endHr;i++) {
        html += '<th>';
        html += String(i).padStart(2, '0') + ":00";
        html += '<th>';
    }
    html += '</tr>';

    html += '<tr>';
    html += `<th>Air Temperature (${weather.hourly_units.temperature_2m})</th>`;
    for (i=startHr;i<=endHr;i++) {
        html += '<th>';
        html += weather.hourly.temperature_2m[i];
        html += '<th>';
    }
    html += '</tr>';
    
    html += '<tr>';
    html += `<th>Wind speed (BFT)</th>`;
    for (i=startHr;i<=endHr;i++) {
        html += '<th>';
        html += kmphToBeaufort(weather.hourly.wind_speed_10m[i]);
        html += '<th>';
    }
    html += '</tr>';

    html += '<tr>';
    html += `<th>Wind gusts (BFT)</th>`;
    for (i=startHr;i<=endHr;i++) {
        html += '<th>';
        html += kmphToBeaufort(weather.hourly.wind_gusts_10m[i]);
        html += '<th>';
    }
    html += '</tr>';

    html += '<tr>';
    html += `<th>Wind direction (${weather.hourly_units.wind_direction_10m})</th>`;
    for (i=startHr;i<=endHr;i++) {
        html += '<th>';
        html += `<span style="transform: rotate(${weather.hourly.wind_direction_10m[i]}deg); display: block; width: 20px; ">↓</span>`
        html += '<th>';
    }
    html += '</tr>';

    html += '</table>';

    return html;
}

function notesFilename(date) {
    let sd = shortDate(date);
    return sd.replace(/\//g, '-') + '.jpg';
}

function shortDate(date) {
    const options = {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }
    return new Intl.DateTimeFormat('en-GB', options).format(new Date(date));
}

function renderTOC(activities) {
    let html = '<h1>Trips</h1><ul>';
    let i = 1;
    activities.forEach((activity) => {
        html += `<li><b>(${i}) <a href="#${activity.id}">${activity.name} (${shortDate(activity.date)})</a></b></li>`;
        i += 1;
    });
    html += '</ul>';
    return html;
}

function renderNotes(activity) {
    if (fs.existsSync(TMPDIR + '/' + activity.notesFile)) {
        return `<p><img src="${activity.notesFile}" style="width: 30vw; min-width: 200px;"/></p>`;
    } else {
        return '';
    }
}

function writeLogbook(activities) {
    let bookHTML = '';

    bookHTML += '<p>';
    bookHTML += renderTOC(activities);
    bookHTML += '</p><hr>';

    bookHTML += '<h2>All trips</h2><p><img src="allmap.jpg" style="width: 70vw; min-width: 330px;"/></p>';

    activities.forEach((activity) => {
        bookHTML += `<a id="${activity.id}"><h1>${activity.name} (${activity.date})</h1></a>`;
        bookHTML += `${Number(kmToMi(activity.distance)).toFixed(1)} miles over ${secondsToHm(activity.elapsedTime)}`;

        if (activity.desc) {
            bookHTML += `<p><i>${activity.desc}</i></p>`;
        }
        if (activity.privNote) {
            bookHTML += `<p><i>${activity.privNote}</i></p>`;
        }
        
        bookHTML += renderNotes(activity);

        // calc bounds for trip, start -> end hr
        startHr = new Date(activity.date).getHours();
        endHr = Math.ceil(startHr + activity.elapsedTime / (60*60));

        if (USE_WEATHER) {
            bookHTML += `<p>${renderWeather(activity.weather, startHr, endHr)}</p>`;
        }

        bookHTML += `<p><img src="${activity.mapFile}" style="width: 30vw; min-width: 330px;"/></p>`;

        bookHTML += '<p>';
        activity.media.forEach((m) => {
            if (m.endsWith('mp4')) {
                bookHTML += '<video width="320" height="240" controls>';
                bookHTML += `<source src="${path.basename(m)}" type="video/mp4">`;
                bookHTML += 'Your browser does not support the video tag.';
                bookHTML += '</video>'
            } else {
                bookHTML += `<img src="${path.basename(m)}" style="width: 20vw; min-width: 100px;" />`;
            }
        });
        bookHTML += '</p>';

        bookHTML += '<hr>';
    });
    fs.writeFileSync(TMPDIR + '/index.html', bookHTML); 
}

function httpGETJSON(url) {
    var opts = {
        url: url,
        method: 'GET',
    };

    return new Promise((resolve, reject) => {
        request(opts, (err, rsp, body) => {
            if (err) {
                reject({error: err});
            } else {
                try {
                    resolve(JSON.parse(body));
                } catch(err) {
                    reject({error: err});
                }
            }
        });
    });
};

function kmphToBeaufort(kmph) {
    if (kmph < 1) {
        return 0;
    }
    if (kmph <= 5) {
        return 1;
    }
    if (kmph <= 11) {
        return 2;
    }
    if (kmph <= 19) {
        return 3;
    }
    if (kmph <= 28) {
        return 4;
    }
    if (kmph <= 38) {
        return 5;
    }
    if (kmph <= 49) {
        return 6;
    }
    if (kmph <= 61) {
        return 7;
    }
    if (kmph <= 74) {
        return 8;
    }
    if (kmph <= 88) {
        return 9;
    }
    if (kmph <= 102) {
        return 10;
    }
    if (kmph <= 117) {
        return 11;
    }
    return 12;
}

function getWeather(activity) {
    let day = new Date(activity.date).toISOString().split('T')[0];

    let url = `https://archive-api.open-meteo.com/v1/archive?latitude=${activity.gpxInfo.lat}&longitude=${activity.gpxInfo.lon}&start_date=${day}&end_date=${day}&hourly=temperature_2m,rain,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m`;
    return httpGETJSON(url);
}

function copyMedia(activity) {
    return Promise.each(activity.media, (media, index, arrayLength) => {
        if (media !== '') {
            if (fs.existsSync(EXPORTDIR + '/' + media)) {
                fs.copyFileSync(EXPORTDIR + '/' + media, TMPDIR + '/' + path.basename(media));
            }
        }
        return Promise.resolve();
    });
}

function copyNotes(activity) {
    if (activity.notesFile !== '') {
        if (fs.existsSync(NOTESDIR + '/' + activity.notesFile)) {
            fs.copyFileSync(NOTESDIR + '/' + activity.notesFile, TMPDIR + '/' + path.basename(activity.notesFile));
        }
    }
    return Promise.resolve();
}

parseActivities().then((activities) => {
    return Promise.each(activities, (activity, index, arrayLength) => {
        console.log(activity.name);
        return fitToGpx(EXPORTDIR + '/' + activity.fitFile, TMPDIR + '/' + activity.gpxFile).then(() => {
            activity.gpxInfo = parseGpx(TMPDIR + '/' + activity.gpxFile);
            if (USE_MAP) {
                return gpxToMap(TMPDIR + '/' + activity.gpxFile, TMPDIR + '/' + activity.mapFile);
            } else {
                return Promise.resolve();
            }
        }).then(() => {
            if (USE_WEATHER) {
                return getWeather(activity);
            } else {
                return Promise.resolve();
            }
        }).then((weather) => {
            activity.weather = weather;
            return Promise.resolve();
        }).then(() => {
            return copyMedia(activity);
        }).then(() => {
            return copyNotes(activity);
        }).then(() => {
            return Promise.resolve();
        });
    }).then(() => {
        //console.log(activities);
        return activities;
    });
}).then((activities) => {
    console.log('Gen combined map');
    let gpxs = [];
    activities.forEach((a) => {
        gpxs.push(TMPDIR + '/' + a.gpxFile);
    });
    return gpxAllToMap(gpxs, TMPDIR + '/allmap.jpg').then(() => {
        return Promise.resolve(activities);
    }).then((activities) => {
        // delete all gpx files
        gpxs.forEach((f) => {
            fs.unlinkSync(f);   // delete GPX
        });
        return Promise.resolve(activities);
    });
}).then((activities) => {
    writeLogbook(activities);
    return Promise.resolve();
}).catch((err) => {
    console.log(err);
});

