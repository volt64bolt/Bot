

# PlaceH43 Bot 

The bot for PlaceH43 and their allies! This bot connects with the jel server and gets it's orders from there. 

## Tampermonkey Install \[BROKEN]
1. Install the [tampermonkey extention](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo?hl=nl)
2. Install the script by pressing this link (Tampermonkey should prompt an install): https://github.com/volt64bolt/Bot/raw/master/placenlbot.user.js
3. Refresh your r/place page and enjoy! A blue pop-up should appear in the top-right corner.

## Headless bot \[WORKING]

### How to get reddit_session cookie
**NOTE: Make sure to widen your inspect window, to make sure you copy the entire cookie value**

1. Go to [r/place](https://reddit.com/r/place)
2. Open dev tools and go to the network tab
3. Refresh the page
4. Click on the first request to reddit.com/r/place (See image)
![Screenshot_20220403_165251](https://user-images.githubusercontent.com/9784257/161433856-27ef7e7c-7f00-4b37-b274-4199ea919aa9.png)
5. Go to the tab called `Cookies`
6. Copy the value of the `reddit_session` cookie

### Installation instructions

1. Install [NodeJS](https://nodejs.org/).
2. Download the source code.
3. Extract the bot script anywhere on your desktop
4. Open a command prompt/terminal in this folder
    Windows: Shift+right mousebutton in the folder -> Click on "open Powershell here"
5. install the dependencies: `npm i`
6. execute the bot `node bot.js SESSION_COOKIE_HERE`
7. BONUS: You can repeat these steps for any amount of accounts you'd want (more than 4 is weird). Keep in mind to use different accounts.
