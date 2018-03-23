const request = require('request')

const main = function(args, callback) {

  // get the client's ip address
  const ip = args['__ow_headers']['x-client-ip']

  // build a POST request to verify the captcha
  var r = {
    uri: 'https://www.google.com/recaptcha/api/siteverify',
    method: 'post',
    form: {
      secret: args['CAPTCHA_SECRET'],
      response: args['g-recaptcha-response'],
      remoteip: ip
    }
  }
  
  // return a Promise because we're about to do an asynchronous thing
  return new Promise((resolve, reject) => {
    
    // make HTTP request to verify the captcha
    request(r, (err, response, body) => {
      if (err) {
        return reject({ statusCode: 302, headers: { location: 'https://glynnbird.com/contact_fail.html' } })
      }

      // it worked! We can now trust our data from the form
      const name = args['name']
      const email = args['email']
      const message = args['message']
      console.log(name, email, message)

      // now we can post this to Slack
      const slackpost = 'You got a message from ' + name + '(' + email + '). It said:\r\n'+message
      console.log(slackpost)
      const r2 = {
        uri: args['SLACK_WEBHOOK_URL'],
        method: 'post',
        form: {
          payload: JSON.stringify({ text: slackpost })
        }
      }
      request(r2, (err, response, body) => {
        console.log(err, body)
        return resolve({ statusCode: 302, headers: { location: 'https://glynnbird.com/contact_success.html' } })
      })

    })
  })
}

exports.main = main
