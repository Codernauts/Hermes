var last_message_timestamp = 0;
var last_message_uuid = '13814000-1dd2-11b2-8080-808080808080'; // Smallest posible UUID for timestamp 0 (1/1/1970 00:00:00)
let prev_json = {};
var first_load = true;
var GLOBAL_CHANNEL_UUID = '13814000-1dd2-11b2-8080-808080808080';
var current_channel = GLOBAL_CHANNEL_UUID;
var my_channels = [];
var username;

const users = {};

if (isElectron()) window.sendUUID(getCookie('hermes_uuid'));

if (getCookie('hermes_theme')) {
    $('#hermes_style').attr('href', 'css/themes/' + getCookie('hermes_theme') + '.css');
}

if (getCookie('hermes_channel')) {
    current_channel = getCookie('hermes_channel')
}

document.addEventListener('touchstart', handleTouchStart);
document.addEventListener('touchmove', handleTouchMove);

swipe_right_handler = () => $("#sidebarbtn").click();
swipe_left_handler = function (x, y) {

    if ($("#darkoverlay").is(":visible")) {
        $("#darkoverlay").click();

    } else { // Quote the message that was swiped left on 

        let id = getMessageAtPosition(y + window.scrollY)

        quote(id)

        id = '#' + id

        if ($(id).hasClass('myMessage')) {
            $(id).toggleClass('myMessageLeft')
            setTimeout(() => {
                $(id).toggleClass('myMessageLeft')
            }, 100)
        } else {
            $(id).toggleClass('theirMessageLeft')
            setTimeout(() => {
                $(id).toggleClass('theirMessageLeft')
            }, 100)
        } // Animation to move the message to the left and back
    }
}
function resizeMessage(message) {
    message.height(message.find(".message_body").height() + (message.find(".quote").length ? message.find(".quote").height() + 16 : 0));
}
function resizeFn() {
    $("#messages").find("li").each(function () {
        resizeMessage($(this))
    });

    let vw = $(window).width()

    if (vw > 600) $("#m").width(vw - 100 - $("#user").width())
    else $("#m").width(vw - 72)

    $('#title').css('left', (vw - 48 - $('#title').width()) / 2)

    resizeChatInfo()
    resizeInput()
}

$(window).on('load', function () {

    const uuid_header = {
        uuid: getCookie('hermes_uuid')
    };

    $("#rightclick").hide();
    $(document).click(function (e) {
        if (e.which == 1) {
            $("#rightclick").hide(100); //Hide on click outside
        }
    });

    let chatinfo_shown = false;

    $('#chatname, #chatinfo').click(e => {
        if (!chatinfo_shown && current_channel !== GLOBAL_CHANNEL_UUID) {
            let chatinfo_click_two = e2 => {
                if (chatinfo_shown && e.timeStamp != e2.timeStamp) {
                    $('#chatinfo').fadeOut(200);
                    chatinfo_shown = false;
                    $(document).off('click', chatinfo_click_two);
                }
            }
            $(document).on('click', chatinfo_click_two);
            $('#chatinfo').fadeIn(200);
            chatinfo_shown = true;
        }
    });
    let last_show = new Date().getTime();
    const delay = 500;
    function hide_chatinfo() {
        if (!chatinfo_shown) {
            setTimeout(() => {
                if ((new Date().getTime() - last_show) > delay) {
                    $('#chatinfo').fadeOut(200);
                } else {
                    hide_chatinfo();
                }
            }, delay);
        }
    }
    $('#chatname,#chatinfo').hover(() => {
        if (current_channel !== GLOBAL_CHANNEL_UUID) {
            $('#chatinfo').fadeIn(200);
            last_show = new Date().getTime();
        }
    }, () => {
        hide_chatinfo();
    });

    httpPostAsync('/api/getSettings', uuid_header, function (res) {
        res = JSON.parse(res)
        username = res.username;
        $('#user').text(username + ':');
        $("#myModal").load("settings", function () {
            $('#logout_uuid').val(getCookie('hermes_uuid'));
            loadSettingsJS(res);
        });

        if ($(window).width() > 600) {  // Run only if app is using the desktop layout 
            $("#m").width($(window).width() - 100 - $("#user").width())

        } else {  // Run only if app is using the mobile layout 
            $("#color").focus(() => $(this).blur()); // Prevent color from being an input field

        }

        $('#message_send_form').submit(function () {
            sendMessage()
            return false;
        });

        $('#m').on('keydown', e => {
            let evtobj = window.event ? event : e
            let modifier = evtobj.ctrlKey || evtobj.metaKey; // Ctrl on Windows, Cmd on Mac
            if (evtobj.keyCode == 13 && modifier) { // Ctrl/Cmd + enter to send the message
                e.preventDefault() // This is so a newline isn't added on Edge
                sendMessage()
            }
        });

        $("#goBottom").click(function () {
            scrollToBottom(true)
        });

        $("#logout").click(function () {
            deleteCookie('hermes_uuid')
            deleteCookie('hermes_theme')
            deleteCookie('hermes_channel')
            // Maybe it should be document.cookie = ''
            location.reload()
        });

        $("#quote").click(function () {
            let id = getMessageAtPosition($("#rightclick").position().top)
            quote(id)
        });

        $("#delete").click(function () {
            let id = '#' + getMessageAtPosition($("#rightclick").position().top)

            let header = uuid_header;
            header.message_uuid = id.substr(9);
            header.channel = current_channel
            httpPostAsync('/api/deletemessage/', header);
        });

        var is_editing = false;

        function setup_edit(id, username_element) {
            let md_message = HTMLtoMD(username_element.next().html(), HTML_RULES)

            is_editing = true;
            let input = $('<textarea id="editing">').val(md_message);
            input.keydown(function (e) { // Add an event listener for this input
                let evtobj = window.event ? event : e
                let modifier = evtobj.ctrlKey || evtobj.metaKey; // Ctrl on Windows, Cmd on Mac
                if (evtobj.keyCode == 13 && modifier) { // Ctrl/Cmd + enter to send the message

                    let edit_header = {
                        uuid: uuid_header.uuid,
                        message: md_message,
                        message_uuid: $(id).attr('id').substr(8),
                        channel: current_channel
                    };

                    if ($(this).val() != '') {
                        edit_header.newmessage = (input.parent().parent().find(".quote").length != 0 ? '"' + input.parent().parent().find(".quote").attr('data-quoted-id') + '"' : "") + $(this).val();
                        httpPostAsync('/api/editmessage/', edit_header);

                    } else httpPostAsync('/api/deletemessage/', edit_header);
                    is_editing = false;
                }
            });
            username_element.next().remove();
            username_element.parent().append(input);
            input.attr('rows', countTextareaLines(input[0]) + '');
            input.parent().parent().height(input.height() + 16 + (input.parent().parent().find(".quote").length != 0 ? input.parent().parent().find(".quote").height() + 10 : 0));
            input.bind('input propertychange', function () {

                input.attr('rows', countTextareaLines(input[0]) + '');
                input.parent().parent().height(input.height() + 16 + (input.parent().parent().find(".quote").length != 0 ? input.parent().parent().find(".quote").height() + 10 : 0));
            });
            username_element.next().focus();
        }

        $("#edit").click(function () {
            let id = '#' + getMessageAtPosition($("#rightclick").position().top)
            let username_element = $(id).find('#m-username');

            setup_edit(id, username_element)
        });

        document.addEventListener('contextmenu', function (e) {
            e.preventDefault(); // Prevent the default menu
            $("#rightclick").hide();
            let chat_message;
            for (let element of $(e.target).parents()) {
                if (element.classList && element.classList.contains('message')) {
                    chat_message = element;
                    break;
                }

            }
            if (chat_message) {
                // Load certain context menu items depending on the message
                if (chat_message.classList.contains('theirMessage'))
                    $("#delete, #edit").hide();
                else
                    $("#delete, #edit").show();


                $("#rightclick").css({ // Show #rightclick at cursor position
                    top: e.pageY + "px",
                    left: e.pageX + "px"
                }).show(100)
            }
        }, false);

        $("#sidebarbtn").click(function () {
            $("#darkoverlay").fadeIn(200);
            $("#sidebar").css("left", "0px");
        });

        $("#darkoverlay").click(function () {
            $("#darkoverlay").fadeOut(200);
            $("#sidebar").css("left", "-333px");
        });

        window.sessionStorage.clear();
        loadChannels();

        $('#addchat').click(() => {
            if ($('#newchatname').width() === 0) {
                let css = {
                    width: '220px'
                }
                $('#newchatname').css(css)
                $('#newchatname').focus();
            }
        });

        $('#newchatname').focusout(() => {
            $('#newchatname').val('')
            $('#newchatname').attr('style', '');
        });

        $('#newchatname').on('keydown', e => {
            let evtobj = window.event ? event : e
            if (evtobj.keyCode == 13) { // Enter
                if(!/^\s*$/.test($('#newchatname').val())){
                    httpPostAsync('api/createChannel', {
                        uuid: uuid_header.uuid, 
                        name: $('#newchatname').val()
                    }, ()=>{
                        $('#newchatname').blur()
                        loadChannels(false);
                        // Change to the new channel
                    })
                }
            } else if (evtobj.keyCode == 27) { // Esc
                $('#newchatname').blur()
            }

        });
    });


    $(window).resize(resizeFn);
    resizeFn();

    let scrolling = false
    $(document).on('scroll mousedown wheel DOMMouseScroll mousewheel', evt => {
        scrolling = true
    });

    setInterval(function () { // Use interval instead of scroll event for better performance
        if (scrolling) {
            // detect only user initiated, not by an .animate though

            let scrollTop = Math.max($('html').scrollTop(), $('body').scrollTop())

            if (scrollTop == 0 && $("#loading-oldmessages").css('display') == 'none' && !hasLoadedEveryMessage && $('#messages').find('.message').first().attr('id')) {
                $("#loading-oldmessages").show();
                loadNext100Messages($('#messages').find('.message').first().attr('id').substr(8));
            }

            if (!isAtBottom()) $('#goBottom').fadeIn(200)
            else $('#goBottom').fadeOut(200)

            scrolling = false
        }
    }, 200)

    $('#m').on('input propertychange', resizeInput)
    resizeChatInfo()
});


// ---------------------
//       Functions
// ---------------------

function loadMessages() {
    httpPostAsync('/api/loadmessages?message_uuid=' + last_message_uuid, { uuid: uuid_header.uuid, channel: current_channel }, function (res) {
        if (res != '') {
            res = JSON.parse(res);
            let messages = res.newmessages;
            let delm = res.deletedmessages;
            delm.forEach(message => {
                $('li#message-' + message.uuid).remove();
                last_message_uuid = message.time_uuid;
            });

            if (messages && messages.length > 0) {
                printMessages(messages);
            }

            if (first_load) {
                $("#loading").hide()
                first_load = false;
            }
        }
    });
    setTimeout(loadMessages, 500)
};

let hasLoadedEveryMessage = false;

function loadLast100Messages(callback) {
    httpPostAsync('/api/load100messages', { uuid: uuid_header.uuid, channel: current_channel }, function (res) {
        if (res !== '[]') {
            res = JSON.parse(res);
            if (res.length != 100) hasLoadedEveryMessage = true;
            printMessages(res, true);
        }
        $("#loading").hide()
        if (callback) callback();
    });
};

function loadNext100Messages(uuid, callback) {
    httpPostAsync('/api/load100messages?message_uuid=' + uuid, { uuid: uuid_header.uuid, channel: current_channel }, function (res) {
        if (res !== '[]') {
            res = JSON.parse(res);
            if (res.length != 100) hasLoadedEveryMessage = true;
            let old_first_message = $('#messages').children().first();

            printMessages(res, true);
            $("#loading-oldmessages").hide()
            $(document).scrollTop(old_first_message.offset().top + $('#separator-top').outerHeight());

        }
        if (callback) callback();
    });
};

function printMessages(messages, prepend) {
    let loadedMessages = $('<div>');
    let prev_day = '';
    $("#messages").append(loadedMessages);
    let bottom = isAtBottom()
    for (let i = 0; i < messages.length; i++) {

        let message_json = messages[i];
        let username = message_json.username;
        let message = convertHTML(message_json.message);

        let time = new Date(message_json.time);
        let day = time.getDate() + '/' + (time.getMonth() + 1) + '/' + time.getFullYear();
        let hour = padNumber(time.getHours()) + ':' + padNumber(time.getMinutes()) + ':' + padNumber(time.getSeconds());

        last_message_timestamp = message_json.time;
        last_message_uuid = message_json.uuid;

        if ($("#messages").find('#' + day.replaceAll(/\//g, '\\/')).length == 0 && day != prev_day) {
            let date_message = $('<li>').attr("class", "date").attr("id", day).append(day);
            loadedMessages.append(date_message);
        }

        if (username == "Admin") { // I couldn't come up with a better solution, feel free to change this if you find anything better
            let user_color = JSON.parse(httpGetSync('/api/getSettings/' + message_json.message.split(" ")[0].substring(1))).color;
            let username_span = $(`<b style="color:${user_color};">`).text(message_json.message.split(" ")[0]);
            let admin_message = $('<li class="date">').append(username_span);
            admin_message.append(" " + message_json.message.split(" ").slice(1).join(" "));
            loadedMessages.append(admin_message);
        }


        if (!Object.keys(users).includes(username.toLowerCase()) && username.toLowerCase() != "admin") {
            let response = httpGetSync("/api/getSettings/" + encodeURIComponent(username));
            users[username.toLowerCase()] = JSON.parse(response);
            users[username.toLowerCase()].displayname = username;
        }
        if (username.toLowerCase() != "admin") { // I couldn't come up with a better solution, feel free to change this if you find anything better
            let color = users[username.toLowerCase()].color;
            let new_message = $(`<li id="message-${last_message_uuid}" class="message" >`);

            let name = $("#message_send_form").find('p').text()
            name = name.substr(0, name.length - 1);

            if (username == name) new_message.addClass('myMessage')
            else new_message.addClass('theirMessage')

            new_message.append($('<img>').attr('src', IMG_URL_HEADER + users[username.toLowerCase()].image).attr("id", "chat_prof_pic"));
            let new_message_body = $('<span>');
            new_message_body.append($('<b id="m-username">').text(username + ': ').css("color", color));

            let messageHTML = message;

            let quoteMatch = message.match(quoteREGEX);
            // So that we dont parse the MD in the quote
            let convertedMDstart = 0;
            let convertedMDend = 0;
            if (quoteMatch) {
                let quote = createQuoteHTML(quoteMatch[1], loadedMessages);
                if (quote) {
                    quote = quote.outerHTML;
                    convertedMDstart = quoteMatch.index;
                    convertedMDend = quoteMatch.index + quote.length;
                    messageHTML = messageHTML.replace(quoteMatch[0], quote)
                }
            }

            //We're going to replace the string before & after the convertedMD
            let message_first_replace = messageHTML.substr(0, convertedMDstart);
            let message_second_replace = messageHTML.substr(convertedMDend, messageHTML.length);
            let message_fisrt_MD = MDtoHTML(message_first_replace);
            let message_second_MD = MDtoHTML(message_second_replace);
            messageHTML = messageHTML.replace(message_first_replace, message_fisrt_MD);
            messageHTML = messageHTML.replace(message_second_replace, message_second_MD);

            let m_body_element = $('<span id="m-body">').html(messageHTML);

            // find the links
            replaceLinks(m_body_element[0]);

            // Mentions
            try {
                let mention_regex = /(@([^ ]+))/g

                let match
                while (match = mention_regex.exec(message)) {
                    let mention = $('<b class="mention">').css('color', users[match[2].toLowerCase()].color).text(match[1])[0].outerHTML
                    m_body_element[0].innerHTML = m_body_element[0].innerHTML.replace(match[1], mention)
                }
            } catch (err) { } // Don't do anything, the mention was invalid so just don't parse it 

            new_message_body.append(deconvertHTML(m_body_element[0].outerHTML));

            let time_el = $("<span class='time'>")

            $(window).width() > 600 ? time_el.text(hour) : time_el.text(hour.substring(0, 5)) // Hide seconds from time if on mobile

            new_message_body.attr('class', 'message_body');

            new_message.append(new_message_body);
            new_message.append(time_el);

            //Insert the quote after the image, this has to be done with all the message created
            new_message.find(".quote").insertBefore(new_message.find("img")).css("display", "block");

            if (message_json.edited) { // It's an edited message
                $('li#message-' + message_json.uuid).replaceWith(new_message);
                message_with_body = $('li#message-' + message_json.uuid);
                last_message_uuid = message_json.time_uuid;
            } else {
                if ($('#messages').find('li#message-' + message_json.uuid).length == 0) {
                    loadedMessages.append(new_message);
                }
            }

            prev_day = day;
        }
    }
    let lmessagesHTML = loadedMessages.html();

    loadedMessages.remove();
    if (prepend) {
        $('#messages').prepend(lmessagesHTML);
    } else {
        $('#messages').append(lmessagesHTML);
    }
    
    $('.MD-img').on('load', () => {
        resizeFn();
        if (first_load) $(document).scrollTop($("#separator-bottom").offset().top)
        if (bottom) scrollToBottom(true)
    });
    
    resizeFn();
    if (first_load) $(document).scrollTop($("#separator-bottom").offset().top)
    if (bottom) scrollToBottom(true)
}
