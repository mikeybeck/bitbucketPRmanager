'use strict';

chrome.runtime.onInstalled.addListener(function() {
  chrome.alarms.onAlarm.addListener(function( alarm ) {
    var today = new Date()
    var curHr = today.getHours()

    if (curHr < 8 || curHr > 18) {
      return;
    }
    
    console.log('checking for prs');
    getPrJson2();
  });
});

function getPrJson2() {
  $.ajax({
    url: 'options.js',
    dataType: "script",
    async: true,
    success: function () {
        var num_unseen_prs = localStorage.getItem('num-unseen-prs');
        jQuery.ajax({
          url: "https://bitbucket.org/api/2.0/repositories/" + repo_owner + "/" + repo_name + "/pullrequests/",
          method: "GET",
          headers: {
              "Authorization": "Basic " + btoa(username + ":" + password)
            },
          dataType: "json",
          success: function(data) { 
              data.values.forEach(element => {
                if (localStorage.getItem('bb-pr-id-counter-bg') < element.id) {
                  localStorage.setItem('bb-pr-id-counter-bg', element.id);
                  num_unseen_prs++;
                }
              });

              chrome.browserAction.setBadgeBackgroundColor({ color: [0, 150, 255, 255] });
              if (num_unseen_prs > 0) {
                chrome.browserAction.setBadgeBackgroundColor({ color: [255, 0, 0, 255] });
              }

              chrome.browserAction.setBadgeText({text: String(num_unseen_prs)});

              localStorage.setItem('num-unseen-prs', num_unseen_prs);
          }
      })
    },
    error: function () {
        chrome.browserAction.setBadgeBackgroundColor({ color: [0, 0, 0, 255] });
        chrome.browserAction.setBadgeText({text: 'ERR'});
        throw new Error("Could not load script " + script);
    }
});
    
}
