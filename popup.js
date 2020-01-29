'use strict';

let changeColor = document.getElementById('changeColor');
let refreshPrs = document.getElementById('refreshPrs');
let showPrs = document.getElementById('showPrs');
let checkForNewPrs = document.getElementById('checkForNewPrs');
let showRequireMyApproval = document.getElementById('showRequireMyApproval');
let showMyPrs = document.getElementById('showMyPrs');

var schema = {
  stores: [{
    name: 'bitbucket-prs',
    indexes: [{
      name: 'id'
   }, {
    name: 'state'
    },
    {
      name: 'approved_by_me'
    },
    {
       name: 'id, title, author, approvals, num_comments, num_comments_prev, link, state, approved_by_me, destination_branch',
       keyPath: ['id', 'title', 'author', 'approvals', 'num_comments', 'num_comments_prev', 'link', 'state', 'approved_by_me', 'destination_branch']
    }]
  }]
},
db = new ydn.db.Storage('db-name', schema);

localStorage.setItem('num-unseen-prs', 0);

checkForNewPrs.onclick = function(element) {
  tryGetPrJson();
};

refreshPrs.onclick = function(element) {
  clearDb();
  setTimeout(function () {
    console.log('Getting all PRs');
    getPrJson('all');
  }, 1000); 
};

showRequireMyApproval.onclick = function(element) {
  if (localStorage.getItem('show_require_approval') == 'true') {
    localStorage.setItem('show_require_approval', 'false');
  } else {
    localStorage.setItem('show_require_approval', 'true');
  }

  displayPrs();
};

showMyPrs.onclick = function(element) {
  if (localStorage.getItem('show_my_prs') == 'true') {
    localStorage.setItem('show_my_prs', 'false');
  } else {
    localStorage.setItem('show_my_prs', 'true');
  }

  displayPrs();
};

showPrs.onclick = function(element) {
  displayPrs();
};

chrome.alarms.create('remindme', {
  delayInMinutes: 1,
  periodInMinutes: 5
});

displayPrs();

document.addEventListener('click', function (event) {

	// If the clicked element doesn't have the right selector, bail
	if (!event.target.matches('.refresh_pr')) return;

	// Don't follow the link
	event.preventDefault();

	// Log the clicked element in the console
  console.log(event.target);
  console.log(event.target.getAttribute('pr_link'));

  getPR(event.target.getAttribute('pr_link'));

}, false);

function clearDb()
{
  var db = new ydn.db.Storage('db-name', schema);

  db.clear();
}

function tryGetPrJson() {
  if (!('indexedDB' in window)) {
    console.log('This browser doesn\'t support IndexedDB');
    return;
  }

  try {
    (function() {
      'use strict';
  
      getPrJson();
    })();
  } catch (err) {
    console.error(err);
  }
}


function getPrJson(update_pr_id = null) {
    jQuery.ajax({
        url: "https://bitbucket.org/api/2.0/repositories/" + repo_owner + "/" + repo_name + "/pullrequests/?pagelen=20", // Get max 20 PRs
        method: "GET",
        headers: {
            "Authorization": "Basic " + btoa(username + ":" + password)
          },
        dataType: "json",
        success: function(data) {

            data.values.forEach(element => {
              if (localStorage.getItem('bb-pr-id-counter') < element.id) {
                localStorage.setItem('bb-pr-id-counter', element.id);
                
                alert('new PRs!');

                getPR(element.links.self.href);
              } else if (update_pr_id === 'all') {
                getPR(element.links.self.href);
              }
            });

            if (update_pr_id && update_pr_id !== 'all') {
              db.get('bitbucket-prs', update_pr_id).done(function(record) {
                getPR(record.api_link);
              });
            }
        }
    })    
  }

function getPR(link) {
  console.log('getting pr ' + link);
    jQuery.ajax({
        url: link,
        method: "GET",
        headers: {
            "Authorization": "Basic " + btoa(username + ":" + password)
          },
        dataType: "json",
        success: function(data) {
            //localStorage.setItem('BB-PR-JSON-' + data.id, JSON.stringify(data));

            var db = new ydn.db.Storage('db-name', schema),
            reviewers = [],
            approved_by_me = false;
          
            console.log(data);

            data.participants.forEach(element => {
              console.log(element.user.display_name);
              console.log(element.approved);
              var reviewer = {
                "name": element.user.display_name,
                "approved": element.approved
              };
              reviewers.push(reviewer);

              if (!approved_by_me) {
                approved_by_me = (element.user.display_name == 'Mike Beck' && element.approved);
              }
            });


              localStorage.setItem(data.id + '_num_comments_prev', localStorage.getItem(data.id + '_num_comments'));
              localStorage.setItem(data.id + '_num_comments', data.comment_count);

              let last_source_commit_hash = localStorage.getItem(data.id + '_last_source_commit_hash');
              let new_commits_added = false;
              localStorage.setItem(data.id + '_last_source_commit_hash_prev', last_source_commit_hash);
              localStorage.setItem(data.id + '_last_source_commit_hash', data.source.commit.hash);
              if (last_source_commit_hash !== data.source.commit.hash) {
                new_commits_added = true;
              }

              db.put('bitbucket-prs', {
                id: data.id,
                title: data.title,
                author: data.author.display_name,
                api_link: data.links.self.href,
                html_link: data.links.html.href,
                state: data.state,
                num_comments: data.comment_count,
                reviewers: reviewers,
                approved_by_me: approved_by_me,
                destination_branch: data.destination.branch.name,
                new_commits_added: new_commits_added
              },
              data.id);

            displayPrs();
        }
    })
}

function displayPrs() {
  $("#prs").empty();
  $("#pr-info").empty();

  var db = new ydn.db.Storage('db-name', schema);

  var q = db.from('bitbucket-prs').where('state', '=', 'OPEN');

  var limit = 20;
  var num_prs = 0;
  var num_approved_by_me = 0;
  var num_my_prs = 0;

  q.list(limit).done(function(objs) {
    objs.forEach(element => {
      console.log(element);
      num_prs++;
      num_my_prs += (element.author === 'Mike Beck');
      var reviewers = '';
      var num_approvals = 0;
      element.reviewers.forEach(reviewer => {
        num_approvals += reviewer.approved;
        num_approved_by_me += (reviewer.name === 'Mike Beck' && reviewer.approved);
        reviewers += '<span style="padding-right:10px; color:' + (reviewer.approved ? 'green' : 'red') + '">' + reviewer.name + '</span>';
      });
      let num_new_comments = (parseInt(element.num_comments) - parseInt(localStorage.getItem(element.id + '_num_comments_prev')));

      let do_not_show = (element.author == 'Mike Beck' && (localStorage.getItem('show_my_prs') == 'false')) || 
        (localStorage.getItem('show_require_approval') == 'true' && element.approved_by_me && element.new_commits_added == false && num_new_comments == 0);

      console.log(do_not_show);
      console.log(element.author);

      if (!do_not_show) {
        $('#prs').append(
          '<div id="' + element.id + '" style="background-color:' + (num_approvals > 1 ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)') + '">' +
          '<a href="' + element.html_link + '" target="_blank">' +
          '<p class="id" style="inline-block">' + element.id + '</p>' +
          '<p class="author" style="inline-block; margin-left: 10px">' + element.author + '</p>' +
          '<p class="title" style="inline-block; margin-left: 10px">' + element.title + '</p>' +
          '<p class="destination_branch" style="inline-block; margin-left: 10px">' + element.destination_branch + '</p>' +
          '<p class="reviewers" style="inline-block; margin-left: 10px">' + reviewers + '</p>' +
          '<p class="num_comments" style="inline-block; margin-left: 10px">' + element.num_comments + ' comments (' + num_new_comments + ' new)</p>' +
          '<p class="approved_by_me" style="inline-block; margin-left: 10px">Approved by me: ' + element.approved_by_me + '</p>' +
          '<p class="new_commits_added" style="inline-block; margin-left: 10px; color:' + (element.new_commits_added ? 'green' : 'red') + '">New commits added: ' + element.new_commits_added + '</p>' +
          '</a>' +
          '<button class="refresh_pr" pr_link="' + element.api_link + '">Refresh</button>' +
          '</div>'
          );
      }
    });

    $('#pr-info').append(
      '<p>' + num_prs + ' open PRs</p>' +
      '<p>' + (num_prs - num_approved_by_me - num_my_prs) + ' not yet approved by me</p>'
    );
  });
}
