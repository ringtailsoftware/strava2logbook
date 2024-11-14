# strava2logbook

A quick and dirty tool to convert from a Strava archive to a custom logbook format.

This tool:

 - Extracts just "Kayaking" events (see `main.js` to change the activity type)
 - Generates a map per event using `gpx2png` https://github.com/joubu/gpx2png
 - Fetches historical weather data for the day and shows wind and temperature for the trip duration
 - Embeds any images/movies uploaded to Strava for the trip
 - Embeds any comments/notes from Strava for the trip
 - Attaches any present image from the `notes` directory with the corresponding date `dd-mm-yyyy.jpg` to allow adding my handwritten notes 
 - Generates a table of contents
 - Generates a map with all trips combined

To use:

 - Download your Strava data archive from https://www.strava.com/account
 - unzip the data archive into `strava2logbook/export` (note, Strava's zip file will extract many files into the current directory)
 - `make`
 - `make shell`
 - `npm install`
 - `node main.js`

The `tmp` directory contains the output. Open `tmp/index.html` in a browser to view.


# Why?

I track all of my kayak journeys using Strava, but don't write much down. For a formal qualification I've been asked to show my logbook so am generating one from the data I have and the historical data I can fetch about the day.

# Is this useful?

To me, very.

To anyone else, maybe. If you're trying to do something similar then it may be helpful.

# License

MIT
