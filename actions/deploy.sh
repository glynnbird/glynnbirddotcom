#!/bin/bash

bx wsk package update glynnbirddotcom --param CAPTCHA_SECRET "$CAPTCHA_SECRET"
bx wsk action update "glynnbirddotcom/contactus" --kind nodejs:6 contactus.js --web true
bx wsk action get "glynnbirddotcom/contactus" --url
