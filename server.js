var window = global ;
var auth = require("./auth") ;

var start = function() {
  window.player = new this.Player(function(event) {
    if (event.name == "started") {
      // signal that the game is started
    }
    else if (event.name == "log") {
      // console.info(event.data) ;
    }
  }) ;
}

var resources = "var resources = {\"images\":[],\"assets\":[],\"maps\":{},\"sounds\":[],\"music\":[]};\nvar graphics = \"M1\";\n";
var graphics = "M1";

global.location = {
  pathname: "",
  hash: ""
}
global.navigator = {
  language: "en"
}

window.ms_libs = [] ;

server_code = `



// file: main.ms
function()
rogue = object
  x = 0
  y = 0
  w = 32
  h = 32
  speed = 2.5
  im = "rogue_down_idle"
  dir = "down"
end

coins = []
pending_removal = []
explosions = []
score = 0
lives = 3
game_state = "play"

speed_level = 1
value_multiplier = 1
godmode = 0
godmode_timer = 0
totems = 0

cost_speed = 10
cost_value = 15
cost_heal = 200
cost_godmode = 2000
cost_totem = 500000

timer = 0
pos_timer = 0

username = ""
online_players = []
other_players = []

// Leaderboard als flache Arrays
lb_names = []
lb_scores = []

// Auth state
auth_field = "user"
auth_password = ""
auth_mode = "login"
auth_error = ""
auth_token = ""

create_explosion = function(new_x, new_y)
  local expl = object
    x = new_x
    y = new_y
    timer = 20
    scale = 1
  end
  explosions.push(expl)
end

apply_player_data = function(msg)
  score = msg.score
  speed_level = msg.speed_level
  value_multiplier = msg.value_multiplier
  rogue.speed = msg.rogue_speed
  cost_speed = msg.cost_speed
  cost_value = msg.cost_value
  lives = msg.lives
  godmode = msg.godmode
  godmode_timer = msg.godmode_timer
  totems = msg.totems
  if msg.pos_x != 0 or msg.pos_y != 0 then
    rogue.x = msg.pos_x
    rogue.y = msg.pos_y
  end
end

init = function()
  connection = new ServerConnection("wss://game.redstonelogik.de")
  myID = "none"
  rogue.x = 0
  rogue.y = 0
  coins = []
  pending_removal = []
  explosions = []
  username = ""
  online_players = []
  other_players = []
  lb_names = []
  lb_scores = []
  pos_timer = 0
  auth_field = "user"
  auth_password = ""
  auth_mode = "login"
  auth_error = ""

  // Defaults
  score = 0
  lives = 3
  speed_level = 1
  value_multiplier = 1
  godmode = 0
  godmode_timer = 0
  totems = 0
  rogue.speed = 2.5
  cost_speed = 10
  cost_value = 15

  // Token aus Storage pruefen
  auth_token = storage.get("rogue_auth_token")
  if auth_token then
    game_state = "connecting"
  else
    auth_token = ""
    game_state = "login"
  end
end

update = function()
  timer = timer + 1

  local message = 0
  for message in connection.messages
    if message.mtype == "id" then
      myID = message.id
      if auth_token != "" and game_state == "connecting" then
        connection.send(object mtype="token_login" token=auth_token end)
      end

    elsif message.mtype == "auth_ok" then
      username = message.name
      auth_token = message.token
      storage.set("rogue_auth_token", message.token)
      auth_error = ""
      game_state = "play"

    elsif message.mtype == "auth_fail" then
      auth_error = message.error
      auth_token = ""
      storage.set("rogue_auth_token", 0)
      game_state = "login"

    elsif message.mtype == "player_data" then
      apply_player_data(message)

    elsif message.mtype == "state" then
      local new_others = []
      local p = 0
      for p in message.players
        if p.name != username then
          local found = 0
          local old = 0
          for old in other_players
            if old.name == p.name then
              found = old
            end
          end
          if found != 0 then
            found.target_x = p.x
            found.target_y = p.y
            found.score = p.score
            new_others.push(found)
          else
            p.target_x = p.x
            p.target_y = p.y
            new_others.push(p)
          end
        else
          score = p.score
        end
      end
      other_players = new_others
      online_players = message.players

      lb_names = []
      lb_scores = []
      for p in message.players
        lb_names.push(p.name)
        lb_scores.push(p.score)
      end

      local swapped = true
      while swapped
        swapped = false
        local j = 0
        for j = 0 to lb_names.length - 2
          if lb_scores[j] < lb_scores[j+1] then
            local tmp_name = lb_names[j]
            local tmp_score = lb_scores[j]
            lb_names[j] = lb_names[j+1]
            lb_scores[j] = lb_scores[j+1]
            lb_names[j+1] = tmp_name
            lb_scores[j+1] = tmp_score
            swapped = true
          end
        end
      end

      local new_coins = []
      local sc = 0
      for sc in message.coins
        local skip = false
        local pri = 0
        for pri in pending_removal
          if pri == sc.id then skip = true end
        end
        if not skip then new_coins.push(sc) end
      end
      coins = new_coins
      local still_pending = []
      local pid = 0
      for pid in pending_removal
        local still_there = false
        local sc2 = 0
        for sc2 in message.coins
          if sc2.id == pid then still_there = true end
        end
        if still_there then still_pending.push(pid) end
      end
      pending_removal = still_pending

    elsif message.mtype == "bomb" then
      create_explosion(message.bx, message.bomb_by)
      audio.playSound("explosion_sound")
      if message.victim == username then
        // Server hat Schaden schon berechnet, warte auf player_data
        if message.gameover then
          game_state = "gameover"
        end
      end
    end
  end

  if keyboard.press.ESCAPE then
    if game_state == "play" then
      game_state = "pause"
    elsif game_state == "pause" then
      game_state = "play"
    elsif game_state == "shop" then
      game_state = "play"
    end
  end

  if keyboard.press.B then
    if game_state == "play" then
      game_state = "shop"
    elsif game_state == "shop" then
      game_state = "play"
    end
  end

  if game_state == "shop" and keyboard.press.R then
    connection.send(object mtype="reset_save" end)
  end

  if game_state == "play" then
    update_game()
  elsif game_state == "shop" then
    update_shop()
  elsif game_state == "gameover" then
    update_gameover()
  elsif game_state == "login" then
    update_login()
  end
end

update_login = function()
  if keyboard.press.TAB then
    if auth_field == "user" then
      auth_field = "pass"
    else
      auth_field = "user"
    end
  end

  local letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  for i = 0 to letters.length - 1
    local ch = letters[i]
    if keyboard.press[ch] then
      if auth_field == "user" and username.length < 14 then
        username = username + ch
      elsif auth_field == "pass" and auth_password.length < 30 then
        auth_password = auth_password + ch
      end
    end
  end

  local nums = "0123456789"
  for i = 0 to nums.length - 1
    local n = nums[i]
    if keyboard.press[n] then
      if auth_field == "user" and username.length < 14 then
        username = username + n
      elsif auth_field == "pass" and auth_password.length < 30 then
        auth_password = auth_password + n
      end
    end
  end

  if keyboard.press.BACKSPACE then
    if auth_field == "user" and username.length > 0 then
      username = username.slice(0, username.length - 1)
    elsif auth_field == "pass" and auth_password.length > 0 then
      auth_password = auth_password.slice(0, auth_password.length - 1)
    end
  end

  if keyboard.press.ENTER then
    if username.length == 0 then
      auth_error = "Bitte Name eingeben"
      auth_field = "user"
    elsif auth_password.length == 0 then
      auth_error = "Bitte Passwort eingeben"
      auth_field = "pass"
    else
      if auth_mode == "login" then
        connection.send(object mtype="login" name=username password=auth_password end)
      else
        connection.send(object mtype="register" name=username password=auth_password end)
      end
      auth_error = "Verbinde..."
    end
  end

  if keyboard.press.SHIFT then
    if auth_mode == "login" then
      auth_mode = "register"
    else
      auth_mode = "login"
    end
    auth_error = ""
  end
end

update_gameover = function()
  if keyboard.press.SPACE or keyboard.press.ENTER then
    connection.send(object mtype="reset_save" end)
    game_state = "play"
  end
end

update_game = function()
  local moving = false

  pos_timer = pos_timer + 1
  if pos_timer >= 2 then
    pos_timer = 0
    if username.length > 0 then
      connection.send(object mtype="pos" x=rogue.x y=rogue.y end)
    end
  end

  if godmode == 1 and keyboard.G then
    connection.send(object mtype="use_godmode" end)
    godmode_timer = godmode_timer - 1
    if godmode_timer <= 0 then
      godmode = 0
      godmode_timer = 0
    end
  end

  if keyboard.RIGHT or keyboard.D then
    rogue.x = rogue.x + rogue.speed
    rogue.dir = "right"
    moving = true
  elsif keyboard.LEFT or keyboard.A then
    rogue.x = rogue.x - rogue.speed
    rogue.dir = "left"
    moving = true
  end

  if keyboard.UP or keyboard.W then
    rogue.y = rogue.y + rogue.speed
    rogue.dir = "up"
    moving = true
  elsif keyboard.DOWN or keyboard.S then
    rogue.y = rogue.y - rogue.speed
    rogue.dir = "down"
    moving = true
  end

  if rogue.x >  screen.width/2  + 16 then rogue.x = -screen.width/2  - 16 end
  if rogue.x < -screen.width/2  - 16 then rogue.x =  screen.width/2  + 16 end
  if rogue.y >  screen.height/2 + 16 then rogue.y = -screen.height/2 - 16 end
  if rogue.y < -screen.height/2 - 16 then rogue.y =  screen.height/2 + 16 end

  if moving then
    rogue.im = "rogue_" + rogue.dir
  else
    rogue.im = "rogue_" + rogue.dir + "_idle"
  end

  // Kollision mit Coins
  local i = 0
  for i = 0 to coins.length - 1
    local c = coins[i]
    if c != 0 then
      local dist = sqrt((rogue.x - c.x)^2 + (rogue.y - c.y)^2)

      local pending = false
      local pri2 = 0
      for pri2 in pending_removal
        if pri2 == c.id then pending = true end
      end

      if not pending and c.item_type == "bomb" and dist < 45 then
        pending_removal.push(c.id)
        connection.send(object mtype="bomb_hit" coin_id=c.id bx=c.x bomb_by=c.y end)
        coins.removeAt(i)
        i = i - 1

      elsif not pending and c.item_type == "coin" and dist < 30 then
        pending_removal.push(c.id)
        connection.send(object mtype="collect" coin_id=c.id end)
        coins.removeAt(i)
        i = i - 1
        audio.playSound("coin")
      end
    end
  end

  // Explosionen updaten
  local j = 0
  for j = 0 to explosions.length - 1
    local expl = explosions[j]
    if expl != 0 then
      expl.timer = expl.timer - 1
      expl.scale = expl.scale + 0.1
      if expl.timer <= 0 then
        explosions.removeAt(j)
        j = j - 1
      end
    end
  end
end

update_shop = function()
  if keyboard.press["1"] then
    connection.send(object mtype="buy_upgrade" slot=1 end)
  end
  if keyboard.press["2"] then
    connection.send(object mtype="buy_upgrade" slot=2 end)
  end
  if keyboard.press["3"] then
    connection.send(object mtype="buy_upgrade" slot=3 end)
  end
  if keyboard.press["4"] then
    connection.send(object mtype="buy_upgrade" slot=4 end)
  end
  if keyboard.press["5"] then
    connection.send(object mtype="buy_upgrade" slot=5 end)
  end
end

draw = function()
  screen.clear("#670000")

  if game_state == "login" then
    draw_login()
  elsif game_state == "connecting" then
    draw_connecting()
  elsif game_state == "play" then
    draw_game()
  elsif game_state == "shop" then
    draw_shop()
  elsif game_state == "gameover" then
    draw_gameover()
  elsif game_state == "pause" then
    draw_pause()
  end
end

draw_connecting = function()
  screen.fillRect(0, 0, screen.width, screen.height, "rgba(0,0,0,0.92)")
  screen.drawText("ROGUE COINS", 0, 60, 35, "#FFD700")
  screen.drawText("Verbinde...", 0, 0, 16, "white")
end

draw_login = function()
  screen.fillRect(0, 0, screen.width, screen.height, "rgba(0,0,0,0.92)")
  screen.drawText("ROGUE COINS", 0, 80, 35, "#FFD700")

  if auth_mode == "login" then
    screen.drawText("LOGIN", 0, 50, 20, "white")
  else
    screen.drawText("REGISTRIEREN", 0, 50, 20, "lime")
  end

  local u_border = "#555"
  if auth_field == "user" then u_border = "#FFD700" end
  screen.drawText("Benutzername:", -60, 28, 10, "gray")
  screen.fillRect(0, 15, 200, 22, "#222")
  screen.drawRect(0, 15, 200, 22, u_border)
  screen.drawText(username, 0, 15, 14, "#FFD700")
  if auth_field == "user" and floor(timer / 20) % 2 == 0 then
    local cx = username.length * 4.5
    screen.fillRect(cx + 2, 15, 2, 12, "#FFD700")
  end

  local p_border = "#555"
  if auth_field == "pass" then p_border = "#FFD700" end
  screen.drawText("Passwort:", -66, -2, 10, "gray")
  screen.fillRect(0, -15, 200, 22, "#222")
  screen.drawRect(0, -15, 200, 22, p_border)
  local p_display = ""
  for i = 0 to auth_password.length - 1
    p_display = p_display + "*"
  end
  screen.drawText(p_display, 0, -15, 14, "#FFD700")
  if auth_field == "pass" and floor(timer / 20) % 2 == 0 then
    local cx = auth_password.length * 4.5
    screen.fillRect(cx + 2, -15, 2, 12, "#FFD700")
  end

  if auth_error != "" then
    screen.drawText(auth_error, 0, -38, 10, "red")
  end

  if auth_mode == "login" then
    screen.drawText("[ENTER] Einloggen", 0, -55, 13, "lime")
    screen.drawText("[SHIFT] Zu Registrierung wechseln", 0, -72, 10, "gray")
  else
    screen.drawText("[ENTER] Registrieren", 0, -55, 13, "lime")
    screen.drawText("[SHIFT] Zu Login wechseln", 0, -72, 10, "gray")
  end
  screen.drawText("[TAB] Feld wechseln", 0, -85, 10, "gray")
end

draw_pause = function()
  draw_game()
  screen.fillRect(0, 0, screen.width, screen.height, "rgba(0,0,0,0.6)")
  screen.drawText("PAUSE", 0, 20, 50, "white")
  screen.drawText("Druecke [ESC] um weiterzuspielen", 0, -30, 15, "white")
end

draw_gameover = function()
  draw_game()
  screen.fillRect(0, 0, screen.width, screen.height, "rgba(0,0,0,0.8)")
  screen.drawText("GAME OVER", 0, 40, 50, "red")
  screen.drawText("Score: " + score, 0, -10, 20, "white")
  screen.drawText("Druecke [SPACE] fuer Neustart", 0, -60, 15, "yellow")
end

draw_game = function()
  local c = 0
  for c in coins
    screen.drawSprite(c.im, c.x, c.y, c.w, c.h)
  end

  local ex = 0
  for ex in explosions
    screen.drawSprite("effects/explosion", ex.x, ex.y, 64 * ex.scale, 64 * ex.scale)
  end

  local op = 0
  for op in other_players
    local prev_x = op.x
    local prev_y = op.y
    op.x += (op.target_x - op.x) * .3
    op.y += (op.target_y - op.y) * .3
    local dx = op.x - prev_x
    local dy = op.y - prev_y
    local op_im = "rogue_down_idle"
    if abs(dx) > 0.3 or abs(dy) > 0.3 then
      if abs(dx) > abs(dy) then
        if dx > 0 then op_im = "rogue_right" else op_im = "rogue_left" end
      else
        if dy > 0 then op_im = "rogue_up" else op_im = "rogue_down" end
      end
      op.last_dir = op_im
    else
      if op.last_dir then
        op_im = op.last_dir + "_idle"
      end
    end
    screen.drawSprite(op_im, op.x, op.y, 32, 32)
    screen.drawText(op.name, op.x, op.y + 22, 8, "cyan")
  end

  screen.drawSprite(rogue.im, rogue.x, rogue.y, rogue.w, rogue.h)
  screen.drawText(username, rogue.x, rogue.y + 22, 8, "lime")

  for i = 1 to 3
    local h_x = -screen.width/2 + 11 + (i * 17)
    local h_y = screen.height/2 - 20
    if i <= lives then
      screen.drawSprite("heart", h_x, h_y, 20, 20)
    else
      screen.drawSprite("heart_empty", h_x, h_y, 20, 20)
    end
  end

  screen.drawText("SCORE: " + score, 0, screen.height/2 - 20, 20, "white")
  screen.drawText("[B] SHOP / [ESC] PAUSE", 0, -screen.height/2 + 20, 15, "#FFD700")

  if totems > 0 then
    screen.drawText("TOTEMS: " + totems, screen.width/2 - 60, screen.height/2 - 20, 15, "gold")
  end

  if godmode == 1 then
    local seconds = floor(godmode_timer / 60)
    screen.drawText("GODMODE: " + seconds + "s", 0, -screen.height/2 + 40, 12, "cyan")
    screen.drawText("(Halte G)", 0, -screen.height/2 + 30, 8, "white")
  end

  local panel_x = screen.width/2 - 55
  screen.fillRect(panel_x, 0, 100, screen.height-50, "rgba(0,0,0,0.55)")
  screen.drawText("LEADERBOARD", panel_x, screen.height/2 - 34, 9, "#FFD700")
  screen.drawText(lb_names.length + " online", panel_x, screen.height/2 - 46, 7, "gray")

  local row = 0
  for row = 0 to lb_names.length - 1
    local py = screen.height/2 - 62 - (row * 14)
    local pname = lb_names[row]
    local pscore = lb_scores[row]
    local col = "white"
    if pname == username then col = "lime" end
    screen.drawText((row+1) + ". " + pname, panel_x - 10, py, 8, col)
    screen.drawText(pscore, panel_x + 28, py, 8, "#FFD700")
  end

  screen.drawText("(c) 2026 Simon Bleher - GNU GPLv3", 145, 95, 4, "#FFD700")
end

draw_shop = function()
  screen.fillRect(0, 0, screen.width, screen.height, "rgba(0,0,0,0.95)")
  screen.drawText("--- SHOP ---", 0, 80, 30, "#FFD700")
  screen.drawText("Dein Gold: " + score, 0, 50, 20, "white")

  screen.drawText("[1] Speed", -100, 20, 15, "#ADD8E6")
  screen.drawText("Lvl: " + speed_level, -100, 5, 10, "gray")
  local col1 = "red"
  if score >= cost_speed then col1 = "lime" end
  screen.drawText("$" + cost_speed, -100, -10, 15, col1)

  screen.drawText("[2] Wert x", 100, 20, 15, "#ADD8E6")
  screen.drawText("x" + value_multiplier, 100, 5, 10, "gray")
  local col2 = "red"
  if score >= cost_value then col2 = "lime" end
  screen.drawText("$" + cost_value, 100, -10, 15, col2)

  screen.drawText("[3] Heal", -100, -40, 15, "#FF69B4")
  local col3 = "red"
  local text3 = "$" + cost_heal
  if lives >= 3 then
    col3 = "gray"
    text3 = "VOLL"
  elsif score >= cost_heal then
    col3 = "lime"
  end
  screen.drawText(text3, -100, -55, 15, col3)

  screen.drawText("[4] GODMODE (+10s)", 100, -40, 12, "cyan")
  local col4 = "red"
  if score >= cost_godmode then col4 = "lime" end
  screen.drawText("$" + cost_godmode, 100, -55, 15, col4)
  if godmode == 1 then
    screen.drawText("Aktuell: " + floor(godmode_timer/60) + "s", 100, -70, 10, "white")
  end

  screen.drawText("[5] TOTEM", 0, -25, 15, "gold")
  screen.drawText("Besitz: " + totems, 0, -40, 10, "white")
  local col5 = "red"
  if score >= cost_totem then col5 = "lime" end
  screen.drawText("$" + cost_totem, 0, -55, 15, col5)

  screen.drawText("Druecke [B] oder [ESC] zum Schliessen", 0, -85, 12, "white")
  screen.drawText("[R] Reset Spielstand", 0, -100, 10, "red")
end


end()



// file: server.ms
function()
serverInit = function()
  print("serverInit laeuft...")
  server = new Server()
  players = object end
  coins = []
  broadcast_timer = 0
  coin_timer = 0
  coin_id_counter = 0
  save_timer = 0
  print("serverInit fertig!")
end

create_server_coin = function(force_safe)
  local c = object end
  c.id = coin_id_counter
  coin_id_counter = coin_id_counter + 1
  c.x = random.next() * 200 - 100
  c.y = 110
  c.speed = 1.5

  local r = random.next()
  if (not force_safe) and r < 0.15 then
    c.item_type = "bomb"
    c.im = "items/bomb"
    c.speed = 2.0
    c.value = 0
    c.w = 20
    c.h = 30
  else
    c.item_type = "coin"
    c.w = 24
    c.h = 24
    local r2 = random.next()
    if r2 < 0.60 then
      c.im = "coins/coin_bronze"
      c.value = 1
      c.speed = 1.5
    elsif r2 < 0.90 then
      c.im = "coins/coin_silver"
      c.value = 3
      c.speed = 2.0
    elsif r2 < 0.99 then
      c.im = "coins/coin_gold"
      c.value = 10
      c.speed = 3.0
    else
      c.im = "coins/coin_diamond"
      c.value = 100
      c.speed = 2.0
    end
  end
  coins.push(c)
end

player_count = function()
  local count = 0
  local c = 0
  for c in server.active_connections
    count = count + 1
  end
  return count
end

save_player_to_db = function(pid)
  local p = players[pid]
  if p != 0 and p != null and p.logged_in == 1 and p.name != "" then
    local data = object end
    data.score = p.score
    data.speed_level = p.speed_level
    data.value_multiplier = p.value_multiplier
    data.rogue_speed = p.rogue_speed
    data.cost_speed = p.cost_speed
    data.cost_value = p.cost_value
    data.lives = p.lives
    data.godmode = p.godmode
    data.godmode_timer = p.godmode_timer
    data.totems = p.totems
    data.pos_x = p.x
    data.pos_y = p.y
    db_save_player(p.name, data)
  end
end

load_player_from_db = function(pid, username)
  local data = db_get_player(username)
  if data != 0 and data != null then
    players[pid].score = data.score
    players[pid].speed_level = data.speed_level
    players[pid].value_multiplier = data.value_multiplier
    players[pid].rogue_speed = data.rogue_speed
    players[pid].cost_speed = data.cost_speed
    players[pid].cost_value = data.cost_value
    players[pid].lives = data.lives
    players[pid].godmode = data.godmode
    players[pid].godmode_timer = data.godmode_timer
    players[pid].totems = data.totems
    players[pid].x = data.pos_x
    players[pid].y = data.pos_y
  end
end

send_player_data = function(conn, pid)
  local p = players[pid]
  conn.send(object
    mtype = "player_data"
    score = p.score
    speed_level = p.speed_level
    value_multiplier = p.value_multiplier
    rogue_speed = p.rogue_speed
    cost_speed = p.cost_speed
    cost_value = p.cost_value
    lives = p.lives
    godmode = p.godmode
    godmode_timer = p.godmode_timer
    totems = p.totems
    pos_x = p.x
    pos_y = p.y
  end)
end

broadcast_all = function()
  local list = []
  local c = 0
  for c in server.active_connections
    local p = players[c.id]
    if p != 0 and p != null and p.logged_in == 1 then
      list.push(object
        name = p.name
        x = p.x
        y = p.y
        score = p.score
      end)
    end
  end
  for c in server.active_connections
    c.send(object
      mtype = "state"
      players = list
      coins = coins
    end)
  end
end

init_player = function(pid)
  players[pid] = object
    name = ""
    x = 0
    y = 0
    score = 0
    logged_in = 0
    speed_level = 1
    value_multiplier = 1
    rogue_speed = 2.5
    cost_speed = 10
    cost_value = 15
    lives = 3
    godmode = 0
    godmode_timer = 0
    totems = 0
  end
end

handle_login_success = function(conn, pid, username, token)
  // Pruefen ob bereits online
  local already_online = 0
  local cc = 0
  for cc in server.active_connections
    if players[cc.id] != 0 and players[cc.id] != null then
      if players[cc.id].name == username and cc.id != pid then
        already_online = 1
      end
    end
  end
  if already_online == 1 then
    conn.send(object mtype="auth_fail" error="Bereits eingeloggt" end)
    return
  end

  players[pid].name = username
  players[pid].logged_in = 1
  load_player_from_db(pid, username)
  print("Login: " + username + " (Score: " + players[pid].score + ")")
  conn.send(object mtype="auth_ok" token=token name=username end)
  send_player_data(conn, pid)
  broadcast_all()
end

serverUpdate = function()
  local conn = 0
  for conn in server.new_connections
    print("Neue Verbindung: " + conn.id)
    conn.send(object mtype="id" id=conn.id end)
    init_player(conn.id)
  end

  for conn in server.closed_connections
    print("Getrennt: " + conn.id)
    save_player_to_db(conn.id)
    players[conn.id] = 0
    broadcast_all()
  end

  local message = 0
  for message in server.messages
    if message.data != 0 then
      local pid = message.connection.id

      if message.data.mtype == "register" then
        local result = auth_register(message.data.name, message.data.password)
        if result.success then
          handle_login_success(message.connection, pid, result.username, result.token)
        else
          message.connection.send(object mtype="auth_fail" error=result.error end)
        end

      elsif message.data.mtype == "login" then
        local result = auth_login(message.data.name, message.data.password)
        if result.success then
          handle_login_success(message.connection, pid, result.username, result.token)
        else
          message.connection.send(object mtype="auth_fail" error=result.error end)
        end

      elsif message.data.mtype == "token_login" then
        local result = auth_validate(message.data.token)
        if result.success then
          handle_login_success(message.connection, pid, result.username, message.data.token)
        else
          message.connection.send(object mtype="auth_fail" error="Token ungueltig" end)
        end

      elsif message.data.mtype == "pos" then
        if players[pid] != 0 and players[pid] != null and players[pid].logged_in == 1 then
          players[pid].x = message.data.x
          players[pid].y = message.data.y
        end

      elsif message.data.mtype == "collect" then
        if players[pid] != 0 and players[pid] != null and players[pid].logged_in == 1 then
          local coin_id = message.data.coin_id
          local vm = players[pid].value_multiplier
          local i = 0
          for i = 0 to coins.length - 1
            if coins[i] != 0 and coins[i].id == coin_id then
              local val = coins[i].value * vm
              players[pid].score = players[pid].score + val
              coins.removeAt(i)
              broadcast_all()
              i = coins.length
            end
          end
        end

      elsif message.data.mtype == "bomb_hit" then
        if players[pid] != 0 and players[pid] != null and players[pid].logged_in == 1 then
          local coin_id = message.data.coin_id
          local bomb_bx = message.data.bx
          local bomb_by = message.data.bomb_by
          local victim = players[pid].name
          local i = 0
          for i = 0 to coins.length - 1
            if coins[i] != 0 and coins[i].id == coin_id then
              coins.removeAt(i)
              i = coins.length
            end
          end
          // Schaden server-seitig berechnen
          if players[pid].godmode == 1 then
            // Kein Schaden bei Godmode
          else
            players[pid].lives = players[pid].lives - 1
            if players[pid].lives <= 0 then
              if players[pid].totems > 0 then
                players[pid].totems = players[pid].totems - 1
                players[pid].lives = 3
              else
                // Game Over - Reset
                players[pid].score = 0
                players[pid].speed_level = 1
                players[pid].value_multiplier = 1
                players[pid].rogue_speed = 2.5
                players[pid].cost_speed = 10
                players[pid].cost_value = 15
                players[pid].lives = 3
                players[pid].godmode = 0
                players[pid].godmode_timer = 0
                players[pid].totems = 0
              end
              save_player_to_db(pid)
            end
          end
          // Explosion an ALLE senden
          local bc = 0
          for bc in server.active_connections
            bc.send(object mtype="bomb" coin_id=coin_id bx=bomb_bx bomb_by=bomb_by victim=victim lives=players[pid].lives totems=players[pid].totems gameover=(players[pid].lives <= 0) end)
          end
          // Aktuellen State an Opfer senden
          send_player_data(message.connection, pid)
          broadcast_all()
        end

      elsif message.data.mtype == "buy_upgrade" then
        if players[pid] != 0 and players[pid] != null and players[pid].logged_in == 1 then
          local slot = message.data.slot
          local p = players[pid]

          if slot == 1 and p.score >= p.cost_speed then
            p.score = p.score - p.cost_speed
            p.rogue_speed = p.rogue_speed + 0.5
            p.speed_level = p.speed_level + 1
            p.cost_speed = floor(p.cost_speed * 1.5)
            save_player_to_db(pid)
            send_player_data(message.connection, pid)

          elsif slot == 2 and p.score >= p.cost_value then
            p.score = p.score - p.cost_value
            p.value_multiplier = p.value_multiplier + 1
            p.cost_value = floor(p.cost_value * 1.8)
            save_player_to_db(pid)
            send_player_data(message.connection, pid)

          elsif slot == 3 and p.score >= 200 and p.lives < 3 then
            p.score = p.score - 200
            p.lives = p.lives + 1
            save_player_to_db(pid)
            send_player_data(message.connection, pid)

          elsif slot == 4 and p.score >= 2000 then
            p.score = p.score - 2000
            p.godmode = 1
            p.godmode_timer = p.godmode_timer + 600
            save_player_to_db(pid)
            send_player_data(message.connection, pid)

          elsif slot == 5 and p.score >= 500000 then
            p.score = p.score - 500000
            p.totems = p.totems + 1
            save_player_to_db(pid)
            send_player_data(message.connection, pid)
          end
          broadcast_all()
        end

      elsif message.data.mtype == "use_godmode" then
        if players[pid] != 0 and players[pid] != null and players[pid].logged_in == 1 then
          if players[pid].godmode == 1 then
            players[pid].godmode_timer = players[pid].godmode_timer - 1
            if players[pid].godmode_timer <= 0 then
              players[pid].godmode = 0
              players[pid].godmode_timer = 0
              save_player_to_db(pid)
              send_player_data(message.connection, pid)
            end
          end
        end

      elsif message.data.mtype == "reset_save" then
        if players[pid] != 0 and players[pid] != null and players[pid].logged_in == 1 then
          players[pid].score = 0
          players[pid].speed_level = 1
          players[pid].value_multiplier = 1
          players[pid].rogue_speed = 2.5
          players[pid].cost_speed = 10
          players[pid].cost_value = 15
          players[pid].lives = 3
          players[pid].godmode = 0
          players[pid].godmode_timer = 0
          players[pid].totems = 0
          save_player_to_db(pid)
          send_player_data(message.connection, pid)
          broadcast_all()
        end

      end
    end
  end

  // Coins bewegen und entfernen
  local i = 0
  for i = 0 to coins.length - 1
    if coins[i] != 0 then
      coins[i].y = coins[i].y - coins[i].speed
      if coins[i].y < -120 then
        coins.removeAt(i)
        i = i - 1
      end
    end
  end

  // Spawn-Rate abhaengig von Spieleranzahl
  local pcount = player_count()
  local max_coins = floor(8 + (pcount - 1) * 5 * 0.75)
  local spawn_rate = max(20, 60 - pcount * 8)
  coin_timer = coin_timer + 1
  if coin_timer >= spawn_rate and coins.length < max_coins then
    coin_timer = 0
    create_server_coin(false)
  end

  // Periodisch alle Spieler speichern (alle 30 Sekunden = 1800 Frames)
  save_timer = save_timer + 1
  if save_timer >= 1800 then
    save_timer = 0
    local sc = 0
    for sc in server.active_connections
      save_player_to_db(sc.id)
    end
  end

  // Broadcast alle 2 Frames
  broadcast_timer = broadcast_timer + 1
  if broadcast_timer >= 2 then
    broadcast_timer = 0
    broadcast_all()
  end
end


end()


`
      

var Compiler, LocalLayer;

Compiler = (function() {
  class Compiler {
    constructor(program) {
      var i, j, len, ref, s;
      this.program = program;
      this.code_saves = [];
      this.code = "";
      this.code = [this.code];
      this.routine = new Routine();
      this.locals = new Locals(this);
      this.count = 0;
      ref = this.program.statements;
      for (i = j = 0, len = ref.length; j < len; i = ++j) {
        s = ref[i];
        this.compile(s);
        if (i < this.program.statements.length - 1) {
          this.routine.POP(s);
        }
      }
      this.routine.optimize();
      this.routine.resolveLabels();
      this.count += this.routine.opcodes.length;
      this.routine.locals_size = this.locals.max_index;
    }

    
    // console.info(JSON.stringify @routine.export())
    // @routine = new Routine(0).import( @routine.export() )
    compile(statement) {
      if (statement instanceof Program.Value) {
        return this.compileValue(statement);
      } else if (statement instanceof Program.Operation) {
        return this.compileOperation(statement);
      } else if (statement instanceof Program.Assignment) {
        return this.compileAssignment(statement);
      } else if (statement instanceof Program.Variable) {
        return this.compileVariable(statement);
      } else if (statement instanceof Program.Function) {
        return this.compileFunction(statement);
      } else if (statement instanceof Program.FunctionCall) {
        return this.compileFunctionCall(statement);
      } else if (statement instanceof Program.While) {
        return this.compileWhile(statement);
      }
      if (statement instanceof Program.SelfAssignment) {
        return this.compileSelfAssignment(statement);
      } else if (statement instanceof Program.Braced) {
        return this.compileBraced(statement);
      } else if (statement instanceof Program.CreateObject) {
        return this.compileCreateObject(statement);
      } else if (statement instanceof Program.Field) {
        return this.compileField(statement);
      } else if (statement instanceof Program.Negate) {
        return this.compileNegate(statement);
      } else if (statement instanceof Program.For) {
        return this.compileFor(statement);
      } else if (statement instanceof Program.ForIn) {
        return this.compileForIn(statement);
      } else if (statement instanceof Program.Not) {
        return this.compileNot(statement);
      } else if (statement instanceof Program.Return) {
        return this.compileReturn(statement);
      } else if (statement instanceof Program.Condition) {
        return this.compileCondition(statement);
      } else if (statement instanceof Program.Break) {
        return this.compileBreak(statement);
      } else if (statement instanceof Program.Continue) {
        return this.compileContinue(statement);
      } else if (statement instanceof Program.CreateClass) {
        return this.compileCreateClass(statement);
      } else if (statement instanceof Program.NewCall) {
        return this.compileNewCall(statement);
      } else if (statement instanceof Program.After) {
        return this.compileAfter(statement);
      } else if (statement instanceof Program.Every) {
        return this.compileEvery(statement);
      } else if (statement instanceof Program.Do) {
        return this.compileDo(statement);
      } else if (statement instanceof Program.Sleep) {
        return this.compileSleep(statement);
      } else if (statement instanceof Program.Delete) {
        return this.compileDelete(statement);
      } else if (true) {
        console.info(statement);
        throw "Not implemented";
      }
    }

    compileAssignment(statement) {
      var arg_index, f, i, index, j, ref;
      if (statement.local) {
        if (statement.field instanceof Program.Variable) {
          if (statement.expression instanceof Program.Function) {
            index = this.locals.register(statement.field.identifier); //# register function locally first
            this.compile(statement.expression); //# then compile function which may refer to itself
            this.routine.arg1[this.routine.arg1.length - 1].import_self = index;
            return this.routine.STORE_LOCAL(index, statement);
          } else if (statement.expression instanceof Program.After || statement.expression instanceof Program.Do || statement.expression instanceof Program.Every) {
            index = this.locals.register(statement.field.identifier); //# register thread locally first
            arg_index = this.routine.arg1.length; //# thread main routine will land here
            this.compile(statement.expression); //# then compile function which may refer to itself
            this.routine.arg1[arg_index].import_self = index;
            return this.routine.STORE_LOCAL(index, statement);
          } else {
            this.compile(statement.expression); //# first compile expression which may refer to another local with same name
            index = this.locals.register(statement.field.identifier); //# then register a local for that name
            return this.routine.STORE_LOCAL(index, statement);
          }
        } else {
          throw "illegal";
        }
      } else {
        if (statement.field instanceof Program.Variable) {
          if (this.locals.get(statement.field.identifier) != null) {
            this.compile(statement.expression);
            index = this.locals.get(statement.field.identifier);
            this.routine.STORE_LOCAL(index, statement);
          } else if (statement.expression instanceof Program.CreateClass) {
            return this.compileUpdateClass(statement.expression, statement.field.identifier);
          } else {
            this.compile(statement.expression);
            this.routine.STORE_VARIABLE(statement.field.identifier, statement);
          }
        } else {
          f = statement.field;
          if (f.expression instanceof Program.Variable) {
            if (f.expression.identifier === "this") {
              this.routine.LOAD_THIS(f);
            } else if (this.locals.get(f.expression.identifier) != null) {
              index = this.locals.get(f.expression.identifier);
              this.routine.LOAD_LOCAL_OBJECT(index, f.expression);
            } else if (f.expression.identifier === "global") {
              this.routine.LOAD_GLOBAL(f);
            } else {
              this.routine.LOAD_VARIABLE_OBJECT(f.expression.identifier, statement);
            }
          } else {
            this.compile(f.expression);
            this.routine.MAKE_OBJECT(statement);
          }
          for (i = j = 0, ref = f.chain.length - 2; j <= ref; i = j += 1) {
            this.compile(f.chain[i]);
            this.routine.LOAD_PROPERTY_OBJECT(f.chain[i]);
          }
          this.compile(f.chain[f.chain.length - 1]);
          this.compile(statement.expression);
          return this.routine.STORE_PROPERTY(statement);
        }
      }
    }

    compileSelfAssignment(statement) {
      var c, f, i, index, j, op, ref;
      switch (statement.operation) {
        case Token.TYPE_PLUS_EQUALS:
          op = "ADD";
          break;
        case Token.TYPE_MINUS_EQUALS:
          op = "SUB";
          break;
        case Token.TYPE_MULTIPLY_EQUALS:
          op = "MUL";
          break;
        case Token.TYPE_DIVIDE_EQUALS:
          op = "DIV";
          break;
        case Token.TYPE_MODULO_EQUALS:
          op = "MODULO";
          break;
        case Token.TYPE_AND_EQUALS:
          op = "BINARY_AND";
          break;
        case Token.TYPE_OR_EQUALS:
          op = "BINARY_OR";
      }
      if (statement.field instanceof Program.Variable) {
        if (this.locals.get(statement.field.identifier) != null) {
          index = this.locals.get(statement.field.identifier);
          this.routine.LOAD_LOCAL(index, statement);
          this.compile(statement.expression);
          this.routine[op](statement, 1);
          this.routine.STORE_LOCAL(index, statement);
        } else {
          this.routine.LOAD_VARIABLE(statement.field.identifier, statement);
          this.compile(statement.expression);
          this.routine[op](statement, 1);
          this.routine.STORE_VARIABLE(statement.field.identifier, statement);
        }
      } else {
        f = statement.field;
        if (f.expression instanceof Program.Variable) {
          if (f.expression.identifier === "this") {
            this.routine.LOAD_THIS(f);
          } else if (this.locals.get(f.expression.identifier) != null) {
            index = this.locals.get(f.expression.identifier);
            this.routine.LOAD_LOCAL_OBJECT(index, statement);
          } else if (f.expression.identifier === "global") {
            this.routine.LOAD_GLOBAL(f);
          } else {
            this.routine.LOAD_VARIABLE_OBJECT(f.expression.identifier, statement);
          }
        } else {
          this.compile(f.expression);
          this.routine.MAKE_OBJECT(statement);
        }
        for (i = j = 0, ref = f.chain.length - 2; j <= ref; i = j += 1) {
          this.compile(f.chain[i]);
          this.routine.LOAD_PROPERTY_OBJECT(f.chain[i]);
        }
        c = f.chain[f.chain.length - 1];
        this.compile(f.chain[f.chain.length - 1]);
        this.routine.LOAD_PROPERTY_ATOP(statement);
        this.compile(statement.expression);
        this.routine[op](statement, 1);
        return this.routine.STORE_PROPERTY(statement);
      }
    }

    compileOperation(op) {
      var jump, ref, ref1;
      if ((ref = op.operation) === "+" || ref === "-" || ref === "*" || ref === "/" || ref === "%" || ref === "&" || ref === "|" || ref === "<<" || ref === ">>") {
        this.compile(op.term1);
        this.compile(op.term2);
        switch (op.operation) {
          case "+":
            this.routine.ADD(op);
            break;
          case "-":
            this.routine.SUB(op);
            break;
          case "*":
            this.routine.MUL(op);
            break;
          case "/":
            this.routine.DIV(op);
            break;
          case "%":
            this.routine.MODULO(op);
            break;
          case "&":
            this.routine.BINARY_AND(op);
            break;
          case "|":
            this.routine.BINARY_OR(op);
            break;
          case "<<":
            this.routine.SHIFT_LEFT(op);
            break;
          case ">>":
            this.routine.SHIFT_RIGHT(op);
        }
      } else if ((ref1 = op.operation) === "==" || ref1 === "!=" || ref1 === "<" || ref1 === ">" || ref1 === "<=" || ref1 === ">=") {
        this.compile(op.term1);
        this.compile(op.term2);
        switch (op.operation) {
          case "==":
            this.routine.EQ(op);
            break;
          case "!=":
            this.routine.NEQ(op);
            break;
          case "<":
            this.routine.LT(op);
            break;
          case ">":
            this.routine.GT(op);
            break;
          case "<=":
            this.routine.LTE(op);
            break;
          case ">=":
            this.routine.GTE(op);
        }
      } else if (op.operation === "and") {
        jump = this.routine.createLabel("and");
        op.term1.nowarning = true;
        op.term2.nowarning = true;
        this.compile(op.term1);
        this.routine.JUMPN_NOPOP(jump, op);
        this.routine.POP(op);
        this.compile(op.term2);
        return this.routine.setLabel(jump);
      } else if (op.operation === "or") {
        jump = this.routine.createLabel("or");
        op.term1.nowarning = true;
        op.term2.nowarning = true;
        this.compile(op.term1);
        this.routine.JUMPY_NOPOP(jump, op);
        this.routine.POP(op);
        this.compile(op.term2);
        return this.routine.setLabel(jump);
      } else if (op.operation === "^") {
        this.compile(op.term1);
        this.compile(op.term2);
        return this.routine.BINARY_OP(Compiler.predefined_binary_functions.pow, op);
      } else {
        return "";
      }
    }

    compileBraced(expression) {
      this.compile(expression.expression);
    }

    compileNegate(expression) {
      if (expression.expression instanceof Program.Value && expression.expression.type === Program.Value.TYPE_NUMBER) {
        return this.routine.LOAD_VALUE(-expression.expression.value, expression);
      } else {
        this.compile(expression.expression);
        return this.routine.NEGATE(expression);
      }
    }

    compileNot(expression) {
      expression.expression.nowarning = true;
      this.compile(expression.expression);
      return this.routine.NOT(expression);
    }

    compileValue(value) {
      var i, j, ref;
      switch (value.type) {
        case Program.Value.TYPE_NUMBER:
          this.routine.LOAD_VALUE(value.value, value);
          break;
        case Program.Value.TYPE_STRING:
          this.routine.LOAD_VALUE(value.value, value);
          break;
        case Program.Value.TYPE_ARRAY:
          this.routine.CREATE_ARRAY(value);
          for (i = j = 0, ref = value.value.length - 1; j <= ref; i = j += 1) {
            this.routine.LOAD_VALUE(i, value);
            this.compile(value.value[i]);
            this.routine.CREATE_PROPERTY(value);
          }
      }
    }

    compileVariable(variable) {
      var index, v;
      v = variable.identifier;
      if (v === "this") {
        return this.routine.LOAD_THIS(variable);
      } else if (v === "global") {
        return this.routine.LOAD_GLOBAL(variable);
      } else if (Compiler.predefined_values[v] != null) {
        return this.routine.LOAD_VALUE(Compiler.predefined_values[v], variable);
      } else if (this.locals.get(v) != null) {
        index = this.locals.get(v);
        return this.routine.LOAD_LOCAL(index, variable);
      } else {
        return this.routine.LOAD_VARIABLE(v, variable);
      }
    }

    compileField(field) {
      var c, i, id, index, j, k, len, ref, ref1;
      if (field.expression.identifier === "keyboard" || field.expression.identifier === "gamepad") {
        field.nowarning = true;
      }
      c = field.chain[field.chain.length - 1];
      if (c instanceof Program.Value && c.value === "type") {
        if (field.chain.length === 1) {
          if (field.expression instanceof Program.Variable) { // variable.type
            id = field.expression.identifier;
            if (this.locals.get(id) != null) {
              index = this.locals.get(id);
              this.routine.LOAD_LOCAL(index, field);
              this.routine.TYPE(field);
            } else if (Compiler.predefined_values[id] != null) {
              this.routine.LOAD_VALUE("number", field);
            } else if ((Compiler.predefined_unary_functions[id] != null) || Compiler.predefined_binary_functions[id]) {
              this.routine.LOAD_VALUE("function", field);
            } else {
              this.routine.VARIABLE_TYPE(id, field.expression);
            }
          } else {
            this.compile(field.expression);
            this.routine.TYPE(field);
          }
        } else {
          this.compile(field.expression);
          for (i = j = 0, ref = field.chain.length - 3; j <= ref; i = j += 1) {
            this.compile(field.chain[i]);
            this.routine.LOAD_PROPERTY(field);
          }
          this.compile(field.chain[field.chain.length - 2]);
          this.routine.PROPERTY_TYPE(field.expression);
        }
      } else {
        this.compile(field.expression);
        ref1 = field.chain;
        for (k = 0, len = ref1.length; k < len; k++) {
          c = ref1[k];
          this.compile(c);
          this.routine.LOAD_PROPERTY(field);
        }
      }
    }

    compileFieldParent(field) {
      var c, i, j, ref;
      this.compile(field.expression);
      for (i = j = 0, ref = field.chain.length - 2; j <= ref; i = j += 1) {
        c = field.chain[i];
        this.compile(c);
        this.routine.LOAD_PROPERTY(field);
      }
    }

    compileFunctionCall(call) {
      var a, funk, i, index, j, k, l, len, len1, len2, len3, len4, m, n, ref, ref1, ref2, ref3, ref4;
      if (call.expression instanceof Program.Field) {
        ref = call.args;
        for (i = j = 0, len = ref.length; j < len; i = ++j) {
          a = ref[i];
          this.compile(a);
        }
        this.compileFieldParent(call.expression);
        this.compile(call.expression.chain[call.expression.chain.length - 1]);
        return this.routine.FUNCTION_APPLY_PROPERTY(call.args.length, call);
      } else if (call.expression instanceof Program.Variable) {
        if (Compiler.predefined_unary_functions[call.expression.identifier] != null) {
          funk = Compiler.predefined_unary_functions[call.expression.identifier];
          if (call.args.length > 0) {
            this.compile(call.args[0]);
          } else {
            this.routine.LOAD_VALUE(0, call);
          }
          return this.routine.UNARY_OP(funk, call);
        } else if (Compiler.predefined_binary_functions[call.expression.identifier] != null) {
          funk = Compiler.predefined_binary_functions[call.expression.identifier];
          if (call.args.length > 0) {
            this.compile(call.args[0]);
          } else {
            this.routine.LOAD_VALUE(0, call);
          }
          if (call.args.length > 1) {
            this.compile(call.args[1]);
          } else {
            this.routine.LOAD_VALUE(0, call);
          }
          return this.routine.BINARY_OP(funk, call);
        } else if (call.expression.identifier === "super") {
          ref1 = call.args;
          for (i = k = 0, len1 = ref1.length; k < len1; i = ++k) {
            a = ref1[i];
            this.compile(a);
          }
          return this.routine.SUPER_CALL(call.args.length, call);
        } else if (this.locals.get(call.expression.identifier) != null) {
          ref2 = call.args;
          for (i = l = 0, len2 = ref2.length; l < len2; i = ++l) {
            a = ref2[i];
            this.compile(a);
          }
          index = this.locals.get(call.expression.identifier);
          this.routine.LOAD_LOCAL(index, call);
          return this.routine.FUNCTION_CALL(call.args.length, call);
        } else {
          ref3 = call.args;
          for (i = m = 0, len3 = ref3.length; m < len3; i = ++m) {
            a = ref3[i];
            this.compile(a);
          }
          this.routine.LOAD_VALUE(call.expression.identifier, call);
          return this.routine.FUNCTION_APPLY_VARIABLE(call.args.length, call);
        }
      } else {
        ref4 = call.args;
        for (n = 0, len4 = ref4.length; n < len4; n++) {
          a = ref4[n];
          this.compile(a);
        }
        this.compile(call.expression);
        return this.routine.FUNCTION_CALL(call.args.length, call);
      }
    }

    compileFor(forloop) {
      var for_continue, for_end, for_start, iterator, save_break, save_continue;
      iterator = this.locals.register(forloop.iterator);
      this.locals.allocate(); // range_to
      this.locals.allocate(); // step
      this.compile(forloop.range_from);
      this.routine.STORE_LOCAL(iterator, forloop);
      this.routine.POP(forloop);
      this.compile(forloop.range_to);
      if (forloop.range_by !== 0) {
        this.compile(forloop.range_by);
      } else {
        this.routine.LOAD_VALUE(0, forloop);
      }
      for_start = this.routine.createLabel("for_start");
      for_continue = this.routine.createLabel("for_continue");
      for_end = this.routine.createLabel("for_end");
      this.routine.FORLOOP_INIT([iterator, for_end], forloop);
      this.routine.setLabel(for_start);
      this.locals.push();
      save_break = this.break_label;
      save_continue = this.continue_label;
      this.break_label = for_end;
      this.continue_label = for_continue;
      this.compileSequence(forloop.sequence);
      this.break_label = save_break;
      this.continue_label = save_continue;
      this.routine.setLabel(for_continue);
      this.routine.FORLOOP_CONTROL([iterator, for_start], forloop);
      this.routine.setLabel(for_end);
      return this.locals.pop();
    }

    compileForIn(forloop) {
      var for_continue, for_end, for_start, iterator, save_break, save_continue;
      iterator = this.locals.register(forloop.iterator);
      this.locals.allocate(); // array
      this.locals.allocate(); // index
      this.compile(forloop.list);
      for_start = this.routine.createLabel("for_start");
      for_continue = this.routine.createLabel("for_continue");
      for_end = this.routine.createLabel("for_end");
      this.routine.FORIN_INIT([iterator, for_end], forloop);
      this.routine.setLabel(for_start);
      this.locals.push();
      save_break = this.break_label;
      save_continue = this.continue_label;
      this.break_label = for_end;
      this.continue_label = for_continue;
      this.compileSequence(forloop.sequence);
      this.break_label = save_break;
      this.continue_label = save_continue;
      this.routine.setLabel(for_continue);
      this.routine.FORIN_CONTROL([iterator, for_start], forloop);
      this.routine.setLabel(for_end);
      return this.locals.pop();
    }

    compileSequence(sequence) {
      var i, j, ref;
      for (i = j = 0, ref = sequence.length - 1; j <= ref; i = j += 1) {
        if (!sequence[i].nopop) {
          this.routine.POP(sequence[i]);
        }
        this.compile(sequence[i]);
      }
    }

    compileWhile(whiloop) {
      var end, save_break, save_continue, start;
      this.locals.push();
      start = this.routine.createLabel("while_start");
      end = this.routine.createLabel("while_end");
      this.routine.LOAD_VALUE(0, whiloop);
      this.routine.setLabel(start);
      this.compile(whiloop.condition);
      this.routine.JUMPN(end);
      save_break = this.break_label;
      save_continue = this.continue_label;
      this.break_label = end;
      this.continue_label = start;
      this.compileSequence(whiloop.sequence);
      this.routine.JUMP(start, whiloop);
      this.break_label = save_break;
      this.continue_label = save_continue;
      this.routine.setLabel(end);
      return this.locals.pop();
    }

    compileBreak(statement) {
      if (this.break_label != null) {
        return this.routine.JUMP(this.break_label);
      }
    }

    compileContinue(statement) {
      if (this.continue_label != null) {
        return this.routine.JUMP(this.continue_label);
      }
    }

    compileFunction(func) {
      var r;
      r = this.compileFunctionBody(func);
      return this.routine.LOAD_ROUTINE(r, func);
    }

    compileFunctionBody(func) {
      var a, args, i, index, j, k, l, label, len, local_index, locals, m, numargs, r, ref, ref1, ref2, ref3, routine;
      routine = this.routine;
      locals = this.locals;
      this.routine = new Routine(func.args != null ? func.args.length : 0);
      this.locals = new Locals(this, locals);
      local_index = this.locals.index;
      this.routine.uses_arguments = true;
      if (func.args != null) {
        if (this.routine.uses_arguments) {
          args = this.locals.register("arguments");
          this.routine.STORE_LOCAL(args, func);
          this.routine.POP(func);
        }
        numargs = this.locals.register("+numargs");
        this.routine.STORE_LOCAL(numargs, func);
        this.routine.POP(func);
        for (i = j = ref = func.args.length - 1; j >= 0; i = j += -1) {
          a = func.args[i];
          index = this.locals.register(a.name);
          this.routine.STORE_LOCAL(index, func);
          this.routine.POP(func);
        }
        for (i = k = 0, ref1 = func.args.length - 1; k <= ref1; i = k += 1) {
          a = func.args[i];
          if (a.default != null) {
            index = this.locals.get(a.name);
            label = this.routine.createLabel("default_arg");
            this.routine.LOAD_VALUE(i, func);
            this.routine.LOAD_LOCAL(numargs, func);
            this.routine.LT(func);
            this.routine.JUMPY(label, func);
            this.compile(a.default);
            this.routine.STORE_LOCAL(index, func);
            this.routine.POP(func);
            this.routine.setLabel(label);
          }
        }
      }
      if (func.sequence.length > 0) {
        for (i = l = 0, ref2 = func.sequence.length - 1; l <= ref2; i = l += 1) {
          this.compile(func.sequence[i]);
          if (i < func.sequence.length - 1) {
            this.routine.POP(func.sequence[i]);
          } else {
            this.routine.RETURN(func.sequence[i]);
          }
        }
      } else {
        this.routine.LOAD_VALUE(0, func);
        this.routine.RETURN(func);
      }
      if ((func.args != null) && !this.locals.arguments_used) {
        this.routine.uses_arguments = false;
        this.routine.remove(0);
        this.routine.remove(0);
      }
      index = 0;
      ref3 = this.locals.imports;
      for (m = 0, len = ref3.length; m < len; m++) {
        i = ref3[m];
        this.routine.OP_INSERT(OPCODES.LOAD_IMPORT, func, index, index * 3);
        this.routine.OP_INSERT(OPCODES.STORE_LOCAL, func, i.index, index * 3 + 1);
        this.routine.OP_INSERT(OPCODES.POP, func, 0, index * 3 + 2);
        this.routine.import_refs.push(i.source);
        index += 1;
      }
      this.routine.optimize();
      this.routine.resolveLabels();
      this.count += this.routine.opcodes.length;
      r = this.routine;
      // console.info r.toString()
      this.routine.locals_size = this.locals.max_index;
      this.routine = routine;
      this.locals = locals;
      return r;
    }

    compileReturn(ret) {
      if (ret.expression != null) {
        this.compile(ret.expression);
        return this.routine.RETURN(ret);
      } else {
        this.routine.LOAD_VALUE(0, ret);
        return this.routine.RETURN(ret);
      }
    }

    compileCondition(condition) {
      var c, chain, condition_end, condition_next, i, j, ref;
      chain = condition.chain;
      this.routine.LOAD_VALUE(0, condition);
      condition_end = this.routine.createLabel("condition_end");
      for (i = j = 0, ref = chain.length - 1; j <= ref; i = j += 1) {
        condition_next = this.routine.createLabel("condition_next");
        c = chain[i];
        c.condition.nowarning = true;
        this.compile(c.condition);
        this.routine.JUMPN(condition_next);
        this.locals.push();
        this.compileSequence(c.sequence);
        this.locals.pop();
        this.routine.JUMP(condition_end, condition);
        this.routine.setLabel(condition_next);
        if (i === chain.length - 1 && (c.else != null)) {
          this.locals.push();
          this.compileSequence(c.else);
          this.locals.pop();
        }
      }
      this.routine.setLabel(condition_end);
    }

    formatField(field) {
      if (field === "constructor") {
        field = "_constructor";
      }
      return field.toString().replace(/"/g, "\\\"");
    }

    compileCreateObject(statement) {
      var f, j, len, ref;
      this.routine.CREATE_OBJECT(statement);
      ref = statement.fields;
      for (j = 0, len = ref.length; j < len; j++) {
        f = ref[j];
        this.routine.LOAD_VALUE(f.field, statement);
        this.compile(f.value);
        this.routine.CREATE_PROPERTY(statement);
      }
    }

    compileCreateClass(statement) {
      var f, j, len, ref, variable;
      if (statement.ext != null) {
        statement.ext.nowarning = true;
        this.compile(statement.ext);
      } else {
        this.routine.LOAD_VALUE(0, statement);
      }
      variable = (statement.ext != null) && statement.ext instanceof Program.Variable ? statement.ext.identifier : 0;
      this.routine.CREATE_CLASS(variable, statement);
      ref = statement.fields;
      for (j = 0, len = ref.length; j < len; j++) {
        f = ref[j];
        this.routine.LOAD_VALUE(f.field, statement);
        this.compile(f.value);
        this.routine.CREATE_PROPERTY(statement);
      }
    }

    compileUpdateClass(statement, variable) {
      this.compileCreateClass(statement);
      return this.routine.UPDATE_CLASS(variable, statement);
    }

    compileNewCall(statement) {
      var a, call, i, j, len, ref;
      call = statement.expression;
      this.routine.LOAD_VALUE(0, statement); // reserve spot on stack for the class instance
      ref = call.args;
      for (i = j = 0, len = ref.length; j < len; i = ++j) {
        a = ref[i];
        this.compile(a);
      }
      this.compile(call.expression);
      this.routine.NEW_CALL(call.args.length, statement);
      return this.routine.POP(statement); // pop return value of class constructor
    }

    compileAfter(after) {
      var r;
      r = this.compileFunctionBody(after);
      this.routine.LOAD_ROUTINE(r, after);
      this.compile(after.delay);
      if ((after.multiplier != null) && after.multiplier !== 1) {
        this.routine.LOAD_VALUE(after.multiplier, after);
        this.routine.MUL(after);
      }
      return this.routine.AFTER(after);
    }

    compileEvery(every) {
      var r;
      r = this.compileFunctionBody(every);
      this.routine.LOAD_ROUTINE(r, every);
      this.compile(every.delay);
      if ((every.multiplier != null) && every.multiplier !== 1) {
        this.routine.LOAD_VALUE(every.multiplier, every);
        this.routine.MUL(every);
      }
      return this.routine.EVERY(every);
    }

    compileDo(dostuff) {
      var r;
      r = this.compileFunctionBody(dostuff);
      this.routine.LOAD_ROUTINE(r, dostuff);
      return this.routine.DO(dostuff);
    }

    compileSleep(sleep) {
      this.compile(sleep.delay);
      if ((sleep.multiplier != null) && sleep.multiplier !== 1) {
        this.routine.LOAD_VALUE(sleep.multiplier, sleep);
        this.routine.MUL(sleep);
      }
      return this.routine.SLEEP(sleep);
    }

    compileDelete(del) {
      var chain, i, j, ref;
      if (del.field instanceof Program.Variable) {
        this.routine.LOAD_THIS(del);
        this.routine.LOAD_VALUE(del.field.identifier, del);
        this.routine.DELETE(del);
      } else {
        this.compile(del.field.expression);
        chain = del.field.chain;
        for (i = j = 0, ref = chain.length - 1; j <= ref; i = j += 1) {
          this.compile(chain[i]);
          if (i < chain.length - 1) {
            this.routine.LOAD_PROPERTY(del);
          }
        }
        this.routine.DELETE(del);
      }
    }

    exec(context) {
      this.processor = new Processor();
      this.processor.load(this.routine);
      return this.processor.run(context);
    }

  };

  Compiler.predefined_unary_functions = {
    "round": Math.round,
    "floor": Math.floor,
    "ceil": Math.ceil,
    "abs": Math.abs,
    "sqrt": Math.sqrt,
    "sin": Math.sin,
    "cos": Math.cos,
    "tan": Math.tan,
    "acos": Math.acos,
    "asin": Math.asin,
    "atan": Math.atan,
    "sind": function(x) {
      return Math.sin(x * Math.PI / 180);
    },
    "cosd": function(x) {
      return Math.cos(x * Math.PI / 180);
    },
    "tand": function(x) {
      return Math.tan(x * Math.PI / 180);
    },
    "asind": function(x) {
      return Math.asin(x) / Math.PI * 180;
    },
    "acosd": function(x) {
      return Math.acos(x) / Math.PI * 180;
    },
    "atand": function(x) {
      return Math.atan(x) / Math.PI * 180;
    },
    "log": Math.log,
    "exp": Math.exp
  };

  Compiler.predefined_binary_functions = {
    "min": Math.min,
    "max": Math.max,
    "pow": Math.pow,
    "atan2": Math.atan2,
    "atan2d": function(y, x) {
      return Math.atan2(y, x) / Math.PI * 180;
    }
  };

  Compiler.predefined_values = {
    PI: Math.PI,
    true: 1,
    false: 0
  };

  return Compiler;

}).call(this);

this.Locals = class Locals {
  constructor(compiler, parent = null) {
    this.compiler = compiler;
    this.parent = parent;
    this.layers = [];
    this.index = 0;
    this.max_index = 0;
    this.push();
    this.imports = [];
  }

  increment() {
    var spot;
    spot = this.index++;
    this.max_index = Math.max(this.index, this.max_index);
    return spot;
  }

  push() {
    return this.layers.push(new LocalLayer(this));
  }

  pop() {
    // resetting the @index below was causing erasure of outer locals
    // when used after the block ; such reset is not needed
    //@index = @layers[@layers.length-1].start_index
    return this.layers.splice(this.layers.length - 1, 1);
  }

  register(name) {
    return this.layers[this.layers.length - 1].register(name);
  }

  allocate() {
    return this.layers[this.layers.length - 1].allocate();
  }

  get(name) {
    var i, index, j, ref, v;
    if (name === "arguments") {
      this.arguments_used = true;
    }
    for (i = j = ref = this.layers.length - 1; j >= 0; i = j += -1) {
      v = this.layers[i].get(name);
      if (v != null) {
        return v;
      }
    }
    if (this.parent != null) {
      v = this.parent.get(name);
      if (v != null) {
        index = this.register(name);
        this.imports.push({
          name: name,
          index: index,
          source: v
        });
        return index;
      }
    }
    return null;
  }

};

LocalLayer = class LocalLayer {
  constructor(locals1) {
    this.locals = locals1;
    this.start_index = this.locals.index;
    this.registered = {};
  }

  register(name) {
    return this.registered[name] = this.locals.increment();
  }

  allocate() {
    return this.locals.increment();
  }

  get(name) {
    if (this.registered[name] != null) {
      return this.registered[name];
    } else {
      return null;
    }
  }

};


this.Parser = (function() {
  class Parser {
    constructor(input, filename = "") {
      this.input = input;
      this.filename = filename;
      if (/^\s*\/\/\s*javascript\s*\n/.test(this.input)) {
        this.input = 'system.javascript("""\n\n' + this.input.replace(/\\/g, "\\\\") + '\n\n""")';
      }
      this.tokenizer = new Tokenizer(this.input, this.filename);
      this.program = new Program();
      this.current_block = [];
      this.current = {
        line: 1,
        column: 1
      };
      this.verbose = false;
      this.nesting = 0;
      this.object_nesting = 0;
      this.not_terminated = [];
      this.api_reserved = {
        screen: true,
        audio: true,
        keyboard: true,
        gamepad: true,
        sprites: true,
        sounds: true,
        music: true,
        assets: true,
        asset_manager: true,
        maps: true,
        touch: true,
        mouse: true,
        fonts: true,
        Sound: true,
        Image: true,
        Sprite: true,
        Map: true,
        system: true,
        storage: true,
        print: true,
        random: true,
        Function: true,
        List: true,
        Object: true,
        String: true,
        Number: true
      };
    }

    nextToken() {
      var token;
      token = this.tokenizer.next();
      if (token == null) {
        this.unexpected_eof = true;
        throw "Unexpected end of file";
      }
      return this.current = token;
    }

    nextTokenOptional() {
      var token;
      token = this.tokenizer.next();
      if (token != null) {
        this.current = token;
      }
      return token;
    }

    parse() {
      var err, expression, nt, token;
      try {
        this.warnings = [];
        while (true) {
          expression = this.parseLine();
          if ((expression == null) && !this.tokenizer.finished()) {
            token = this.tokenizer.next();
            if ((token != null) && token.reserved_keyword) {
              if (token.value === "end") {
                this.error("Too many 'end'");
              } else {
                this.error(`Misuse of reserved keyword: '${token.value}'`);
              }
            } else {
              this.error("Unexpected data");
            }
          }
          if (expression === null) {
            break;
          }
          this.current_block.push(expression);
          this.program.add(expression);
          if (this.verbose) {
            console.info(expression);
          }
        }
        return this;
      } catch (error1) {
        err = error1;
        //console.info "Error at line: #{@current.line} column: #{@current.column}"
        if (this.not_terminated.length > 0 && err === "Unexpected end of file") {
          nt = this.not_terminated[this.not_terminated.length - 1];
          return this.error_info = {
            error: `Unterminated '${nt.value}' ; no matching 'end' found`,
            line: nt.line,
            column: nt.column
          };
        } else {
          return this.error_info = {
            error: err,
            line: this.current.line,
            column: this.current.column
          };
        }
      }
    }

    //console.error err
    parseLine() {
      var token;
      token = this.nextTokenOptional();
      if (token == null) {
        return null;
      }
      switch (token.type) {
        case Token.TYPE_RETURN:
          return new Program.Return(token, this.parseExpression());
        case Token.TYPE_BREAK:
          return new Program.Break(token);
        case Token.TYPE_CONTINUE:
          return new Program.Continue(token);
        case Token.TYPE_LOCAL:
          return this.parseLocalAssignment(token);
        default:
          this.tokenizer.pushBack(token);
          return this.parseExpression();
      }
    }

    parseExpression(filter, first_function_call = false) {
      var access, expression;
      expression = this.parseExpressionStart();
      if (expression == null) {
        return null;
      }
      while (true) {
        access = this.parseExpressionSuffix(expression, filter);
        if (access == null) {
          return expression;
        }
        if (first_function_call && access instanceof Program.FunctionCall) {
          return access;
        }
        expression = access;
      }
    }

    assertExpression(filter, first_function_call = false) {
      var exp;
      exp = this.parseExpression(filter, first_function_call);
      if (exp == null) {
        throw "Expression expected";
      }
      return exp;
    }

    parseExpressionSuffix(expression, filter) {
      var field, identifier, token;
      token = this.nextTokenOptional();
      if (token == null) {
        return (filter === "self" ? expression : null);
      }
      switch (token.type) {
        case Token.TYPE_DOT:
          if (expression instanceof Program.Value && expression.type === Program.Value.TYPE_NUMBER) {
            this.tokenizer.pushBack(token);
            return null;
          } else {
            this.tokenizer.changeNumberToIdentifier();
            identifier = this.assertBroadIdentifier("Expected identifier");
            return Program.CreateFieldAccess(token, expression, new Program.Value(identifier, Program.Value.TYPE_STRING, identifier.value));
          }
          break;
        case Token.TYPE_OPEN_BRACKET:
          field = this.assertExpression();
          this.assert(Token.TYPE_CLOSED_BRACKET, "Expected ']'");
          return Program.CreateFieldAccess(token, expression, field);
        case Token.TYPE_OPEN_BRACE:
          return this.parseFunctionCall(token, expression);
        case Token.TYPE_EQUALS:
          return this.parseAssignment(token, expression);
        case Token.TYPE_PLUS_EQUALS:
          return this.parseSelfAssignment(token, expression, token.type);
        case Token.TYPE_MINUS_EQUALS:
          return this.parseSelfAssignment(token, expression, token.type);
        case Token.TYPE_MULTIPLY_EQUALS:
          return this.parseSelfAssignment(token, expression, token.type);
        case Token.TYPE_DIVIDE_EQUALS:
          return this.parseSelfAssignment(token, expression, token.type);
        case Token.TYPE_MODULO_EQUALS:
        case Token.TYPE_AND_EQUALS:
        case Token.TYPE_OR_EQUALS:
          return this.parseSelfAssignment(token, expression, token.type);
        default:
          if (filter === "self") {
            this.tokenizer.pushBack(token);
            return expression;
          } else if (token.is_binary_operator && filter !== "noop") {
            return this.parseBinaryOperation(token, expression);
          } else {
            this.tokenizer.pushBack(token);
            return null;
          }
      }
    }

    parseExpressionStart() {
      var next, token;
      token = this.nextTokenOptional();
      if (token == null) {
        return null;
      }
      switch (token.type) {
        case Token.TYPE_IDENTIFIER: // variable name
          return new Program.Variable(token, token.value);
        case Token.TYPE_NUMBER:
          return this.parseNumberExpression(token);
        case Token.TYPE_PLUS:
          return this.assertExpression();
        case Token.TYPE_MINUS:
          return this.parseExpressionSuffix(new Program.Negate(token, this.assertExpression("noop")), "self");
        case Token.TYPE_NOT:
          return this.parseExpressionSuffix(new Program.Not(token, this.assertExpression("noop")), "self");
        case Token.TYPE_STRING:
          return this.parseStringExpression(token);
        case Token.TYPE_IF:
          return this.parseIf(token);
        case Token.TYPE_FOR:
          return this.parseFor(token);
        case Token.TYPE_WHILE:
          return this.parseWhile(token);
        case Token.TYPE_OPEN_BRACE:
          return this.parseBracedExpression(token);
        case Token.TYPE_OPEN_BRACKET:
          return this.parseArray(token);
        case Token.TYPE_FUNCTION:
          return this.parseFunction(token);
        case Token.TYPE_OBJECT:
          return this.parseObject(token);
        case Token.TYPE_CLASS:
          return this.parseClass(token);
        case Token.TYPE_NEW:
          return this.parseNew(token);
        case Token.TYPE_DOT:
          next = this.assert(Token.TYPE_NUMBER, "malformed number");
          if (!Number.isInteger(next.value)) {
            throw "malformed number";
          }
          return new Program.Value(token, Program.Value.TYPE_NUMBER, Number.parseFloat(`.${next.string_value}`));
        case Token.TYPE_AFTER:
          return this.parseAfter(token);
        case Token.TYPE_EVERY:
          return this.parseEvery(token);
        case Token.TYPE_DO:
          return this.parseDo(token);
        case Token.TYPE_SLEEP:
          return this.parseSleep(token);
        case Token.TYPE_DELETE:
          return this.parseDelete(token);
        default:
          this.tokenizer.pushBack(token);
          return null;
      }
    }

    parseNumberExpression(number) {
      return new Program.Value(number, Program.Value.TYPE_NUMBER, number.value);
    }

    parseStringExpression(string) {
      var token;
      token = this.nextTokenOptional();
      if (token == null) {
        return new Program.Value(string, Program.Value.TYPE_STRING, string.value);
      } else {
        this.tokenizer.pushBack(token);
        return new Program.Value(string, Program.Value.TYPE_STRING, string.value);
      }
    }

    parseArray(bracket) {
      var res, token;
      res = [];
      while (true) {
        token = this.nextToken();
        if (token.type === Token.TYPE_CLOSED_BRACKET) {
          return new Program.Value(bracket, Program.Value.TYPE_ARRAY, res);
        } else if (token.type === Token.TYPE_COMMA) {
          continue;
        } else {
          this.tokenizer.pushBack(token);
          res.push(this.assertExpression());
        }
      }
    }

    parseBinaryOperation(operation, term1) {
      var ops, terms, token;
      ops = [new Program.Operation(operation, operation.value)];
      terms = [term1];
      terms.push(this.assertExpression("noop"));
      while (true) {
        token = this.nextTokenOptional();
        if (token == null) {
          break;
        }
        if (!token.is_binary_operator) {
          this.tokenizer.pushBack(token);
          break;
        }
        ops.push(new Program.Operation(token, token.value));
        terms.push(this.assertExpression("noop"));
      }
      return Program.BuildOperations(ops, terms);
    }

    parseAssignment(token, expression) {
      var res;
      if (!(expression instanceof Program.Variable) && !(expression instanceof Program.Field)) {
        throw "Expected variable identifier or property";
      }
      if (this.object_nesting === 0 && expression instanceof Program.Variable && this.api_reserved[expression.identifier]) {
        this.warnings.push({
          type: "assigning_api_variable",
          identifier: expression.identifier,
          line: token.line,
          column: token.column
        });
      }
      if (expression instanceof Program.Field) {
        this.object_nesting += 1;
        res = new Program.Assignment(token, expression, this.assertExpression());
        this.object_nesting -= 1;
      } else {
        res = new Program.Assignment(token, expression, this.assertExpression());
      }
      return res;
    }

    parseSelfAssignment(token, expression, operation) {
      if (!(expression instanceof Program.Variable) && !(expression instanceof Program.Field)) {
        throw "Expected variable identifier or property";
      }
      return new Program.SelfAssignment(token, expression, operation, this.assertExpression());
    }

    parseLocalAssignment(local) {
      var identifier;
      identifier = this.assert(Token.TYPE_IDENTIFIER, "Expected identifier");
      this.assert(Token.TYPE_EQUALS, "Expected '='");
      return new Program.Assignment(local, new Program.Variable(identifier, identifier.value), this.assertExpression(), true);
    }

    parseBracedExpression(open) {
      var expression, token;
      expression = this.assertExpression();
      token = this.nextToken();
      if (token.type === Token.TYPE_CLOSED_BRACE) {
        return new Program.Braced(open, expression);
      } else {
        return this.error("missing closing parenthese");
      }
    }

    parseFunctionCall(brace_token, expression) {
      var args, start, token;
      args = [];
      this.last_function_call = new Program.FunctionCall(brace_token, expression, args);
      this.last_function_call.argslimits = [];
      while (true) {
        token = this.nextTokenOptional();
        if (token == null) {
          return this.error("missing closing parenthese");
        } else if (token.type === Token.TYPE_CLOSED_BRACE) {
          return new Program.FunctionCall(token, expression, args);
        } else if (token.type === Token.TYPE_COMMA) {
          continue;
        } else {
          this.tokenizer.pushBack(token);
          start = token.start;
          args.push(this.assertExpression());
          this.last_function_call.argslimits.push({
            start: start,
            end: this.tokenizer.index - 1
          });
        }
      }
    }

    addTerminable(token) {
      return this.not_terminated.push(token);
    }

    endTerminable() {
      if (this.not_terminated.length > 0) {
        this.not_terminated.splice(this.not_terminated.length - 1, 1);
      }
    }

    parseFunction(funk) {
      var args, line, sequence, token;
      this.nesting += 1;
      this.addTerminable(funk);
      args = this.parseFunctionArgs();
      sequence = [];
      while (true) {
        token = this.nextToken();
        if (token.type === Token.TYPE_END) {
          this.nesting -= 1;
          this.endTerminable();
          return new Program.Function(funk, args, sequence, token);
        } else {
          this.tokenizer.pushBack(token);
          line = this.parseLine();
          if (line != null) {
            sequence.push(line);
          } else {
            this.error("Unexpected data while parsing function");
          }
        }
      }
    }

    parseFunctionArgs() {
      var args, exp, last, token;
      token = this.nextToken();
      args = [];
      last = null;
      if (token.type !== Token.TYPE_OPEN_BRACE) {
        return this.error("Expected opening parenthese");
      }
      while (true) {
        token = this.nextToken();
        if (token.type === Token.TYPE_CLOSED_BRACE) {
          return args;
        } else if (token.type === Token.TYPE_COMMA) {
          last = null;
          continue;
        } else if (token.type === Token.TYPE_EQUALS && last === "argument") {
          exp = this.assertExpression();
          args[args.length - 1].default = exp;
        } else if (token.type === Token.TYPE_IDENTIFIER) {
          last = "argument";
          args.push({
            name: token.value
          });
        } else {
          return this.error("Unexpected token");
        }
      }
    }

    warningAssignmentCondition(expression) {
      if (expression instanceof Program.Assignment) {
        return this.warnings.push({
          type: "assignment_as_condition",
          line: expression.token.line,
          column: expression.token.column
        });
      }
    }

    parseIf(iftoken) {
      var chain, current, line, token;
      this.addTerminable(iftoken);
      current = {
        condition: this.assertExpression(),
        sequence: []
      };
      this.warningAssignmentCondition(current.condition);
      chain = [];
      token = this.nextToken();
      if (token.type !== Token.TYPE_THEN) {
        return this.error("Expected 'then'");
      }
      while (true) {
        token = this.nextToken();
        if (token.type === Token.TYPE_ELSIF) {
          chain.push(current);
          current = {
            condition: this.assertExpression(),
            sequence: []
          };
          this.warningAssignmentCondition(current.condition);
          this.assert(Token.TYPE_THEN, "Expected 'then'");
        } else if (token.type === Token.TYPE_ELSE) {
          current.else = [];
        } else if (token.type === Token.TYPE_END) {
          chain.push(current);
          this.endTerminable();
          return new Program.Condition(iftoken, chain);
        } else {
          this.tokenizer.pushBack(token);
          line = this.parseLine();
          if (line == null) {
            throw Error("Unexpected data while parsing if");
          }
          if (current.else != null) {
            current.else.push(line);
          } else {
            current.sequence.push(line);
          }
        }
      }
    }

    assert(type, error) {
      var token;
      token = this.nextToken();
      if (token.type !== type) {
        throw error;
      }
      return token;
    }

    assertBroadIdentifier(error) {
      var token;
      token = this.nextToken();
      if (token.type !== Token.TYPE_IDENTIFIER && token.reserved_keyword) {
        token.type = Token.TYPE_IDENTIFIER;
      }
      if (token.type !== Token.TYPE_IDENTIFIER) {
        throw error;
      }
      return token;
    }

    error(text) {
      throw text;
    }

    parseFor(fortoken) {
      var iterator, list, range_by, range_from, range_to, token;
      iterator = this.assertExpression();
      if (iterator instanceof Program.Assignment) {
        range_from = iterator.expression;
        iterator = iterator.field;
        token = this.nextToken();
        if (token.type !== Token.TYPE_TO) {
          return this.error("Expected 'to'");
        }
        range_to = this.assertExpression();
        token = this.nextToken();
        if (token.type === Token.TYPE_BY) {
          range_by = this.assertExpression();
        } else {
          range_by = 0;
          this.tokenizer.pushBack(token);
        }
        return new Program.For(fortoken, iterator.identifier, range_from, range_to, range_by, this.parseSequence(fortoken));
      } else if (iterator instanceof Program.Variable) {
        this.assert(Token.TYPE_IN, "Error expected keyword 'in'");
        list = this.assertExpression();
        return new Program.ForIn(fortoken, iterator.identifier, list, this.parseSequence(fortoken));
      } else {
        return this.error("Malformed for loop");
      }
    }

    parseWhile(whiletoken) {
      var condition;
      condition = this.assertExpression();
      return new Program.While(whiletoken, condition, this.parseSequence(whiletoken));
    }

    parseSequence(start_token) {
      var line, sequence, token;
      if (start_token != null) {
        this.addTerminable(start_token);
      }
      this.nesting += 1;
      sequence = [];
      while (true) {
        token = this.nextToken();
        if (token.type === Token.TYPE_END) {
          if (start_token != null) {
            this.endTerminable();
          }
          this.nesting -= 1;
          return sequence;
        } else {
          this.tokenizer.pushBack(token);
          line = this.parseLine();
          if (line == null) {
            this.error("Unexpected data");
          }
          sequence.push(line);
        }
      }
      return sequence;
    }

    parseObject(object) {
      var exp, fields, token;
      this.nesting += 1;
      this.object_nesting += 1;
      this.addTerminable(object);
      fields = [];
      while (true) {
        token = this.nextToken();
        if (token.type === Token.TYPE_END) {
          this.nesting -= 1;
          this.object_nesting -= 1;
          this.endTerminable();
          return new Program.CreateObject(object, fields);
        } else {
          if (token.type !== Token.TYPE_IDENTIFIER && token.reserved_keyword) {
            token.type = Token.TYPE_IDENTIFIER;
          }
          if (token.type === Token.TYPE_STRING) {
            token.type = Token.TYPE_IDENTIFIER;
          }
          if (token.type === Token.TYPE_IDENTIFIER) {
            this.assert(Token.TYPE_EQUALS, "Expected '='");
            exp = this.assertExpression();
            fields.push({
              field: token.value,
              value: exp
            });
          } else {
            return this.error("Malformed object");
          }
        }
      }
    }

    parseClass(object) {
      var exp, ext, fields, token;
      this.nesting += 1;
      this.object_nesting += 1;
      this.addTerminable(object);
      fields = [];
      token = this.nextToken();
      if (token.type === Token.TYPE_EXTENDS) {
        ext = this.assertExpression();
        token = this.nextToken();
      }
      while (true) {
        if (token.type === Token.TYPE_END) {
          this.nesting -= 1;
          this.object_nesting -= 1;
          this.endTerminable();
          return new Program.CreateClass(object, ext, fields);
        } else {
          if (token.type !== Token.TYPE_IDENTIFIER && token.reserved_keyword) {
            token.type = Token.TYPE_IDENTIFIER;
          }
          if (token.type === Token.TYPE_STRING) {
            token.type = Token.TYPE_IDENTIFIER;
          }
          if (token.type === Token.TYPE_IDENTIFIER) {
            this.assert(Token.TYPE_EQUALS, "Expected '='");
            exp = this.assertExpression();
            fields.push({
              field: token.value,
              value: exp
            });
          } else {
            return this.error("Malformed object");
          }
        }
        token = this.nextToken();
      }
    }

    parseNew(token) {
      var exp;
      exp = this.assertExpression(null, true);
      return new Program.NewCall(token, exp);
    }

    parseAfter(after) {
      var delay, line, multiplier, sequence, token;
      this.nesting += 1;
      this.addTerminable(after);
      delay = this.assertExpression();
      token = this.nextToken();
      multiplier = null;
      if (token.type === Token.TYPE_IDENTIFIER && this.multipliers[token.value]) {
        multiplier = this.multipliers[token.value];
        token = this.nextToken();
      }
      if ((token == null) || token.type !== Token.TYPE_DO) {
        this.error("Expected keyword 'do'");
      }
      sequence = [];
      while (true) {
        token = this.nextToken();
        if (token.type === Token.TYPE_END) {
          this.nesting -= 1;
          this.endTerminable();
          return new Program.After(after, delay, sequence, token, multiplier);
        } else {
          this.tokenizer.pushBack(token);
          line = this.parseLine();
          if (line != null) {
            sequence.push(line);
          } else {
            this.error("Unexpected data while parsing after");
          }
        }
      }
    }

    parseEvery(every) {
      var delay, line, multiplier, sequence, token;
      this.nesting += 1;
      this.addTerminable(every);
      delay = this.assertExpression();
      token = this.nextToken();
      multiplier = null;
      if (token.type === Token.TYPE_IDENTIFIER && this.multipliers[token.value]) {
        multiplier = this.multipliers[token.value];
        token = this.nextToken();
      }
      if ((token == null) || token.type !== Token.TYPE_DO) {
        this.error("Expected keyword 'do'");
      }
      sequence = [];
      while (true) {
        token = this.nextToken();
        if (token.type === Token.TYPE_END) {
          this.nesting -= 1;
          this.endTerminable();
          return new Program.Every(every, delay, sequence, token, multiplier);
        } else {
          this.tokenizer.pushBack(token);
          line = this.parseLine();
          if (line != null) {
            sequence.push(line);
          } else {
            this.error("Unexpected data while parsing after");
          }
        }
      }
    }

    parseDo(do_token) {
      var line, sequence, token;
      this.nesting += 1;
      this.addTerminable(do_token);
      sequence = [];
      while (true) {
        token = this.nextToken();
        if (token.type === Token.TYPE_END) {
          this.nesting -= 1;
          this.endTerminable();
          return new Program.Do(do_token, sequence, token);
        } else {
          this.tokenizer.pushBack(token);
          line = this.parseLine();
          if (line != null) {
            sequence.push(line);
          } else {
            this.error("Unexpected data while parsing after");
          }
        }
      }
    }

    parseSleep(sleep) {
      var delay, multiplier, token;
      delay = this.assertExpression();
      token = this.nextToken();
      multiplier = null;
      if (token != null) {
        if (token.type === Token.TYPE_IDENTIFIER && this.multipliers[token.value]) {
          multiplier = this.multipliers[token.value];
        } else {
          this.tokenizer.pushBack(token);
        }
      }
      return new Program.Sleep(sleep, delay, multiplier);
    }

    parseDelete(del) {
      var v;
      v = this.parseExpression();
      if ((v == null) || (!(v instanceof Program.Variable) && !(v instanceof Program.Field))) {
        return this.error("expecting variable name or property access after keyword `delete`");
      } else {
        return new Program.Delete(del, v);
      }
    }

  };

  Parser.prototype.multipliers = {
    millisecond: 1,
    milliseconds: 1,
    second: 1000,
    seconds: 1000,
    minute: 60000,
    minutes: 60000,
    hour: 60000 * 60,
    hours: 60000 * 60,
    day: 60000 * 60 * 24,
    days: 60000 * 60 * 24
  };

  return Parser;

}).call(this);


this.Processor = class Processor {
  constructor(runner) {
    this.runner = runner;
    this.locals = [];
    this.stack = [];
    this.call_stack = [];
    this.log = false;
    this.time_limit = 2e308;
    this.done = true;
  }

  load(routine1) {
    this.routine = routine1;
    return this.resetState();
  }

  resetState() {
    this.local_index = 0;
    this.stack_index = -1;
    this.op_index = 0;
    this.call_stack_index = 0;
    this.global = null;
    this.object = this.routine.object || null;
    this.locals_offset = 0;
    this.call_super = null;
    this.call_supername = "";
    return this.done = false;
  }

  resolveParentClass(obj, global) {
    if ((obj.class != null) && typeof obj.class === "string") {
      if (global[obj.class] != null) {
        obj.class = global[obj.class];
        return this.resolveParentClass(obj.class, global);
      }
    } else if (obj.class != null) {
      return this.resolveParentClass(obj.class, global);
    }
  }

  applyFunction(args) {}

  routineAsFunction(routine, context) {
    var f, proc;
    proc = new Processor(this.runner);
    f = function() {
      var a, count, i, j, k, ref, ref1;
      count = Math.min(routine.num_args, arguments.length);
      proc.load(routine);
      for (i = j = 0, ref = count - 1; j <= ref; i = j += 1) {
        proc.stack[++proc.stack_index] = arguments[i] || 0;
      }
      proc.stack[++proc.stack_index] = arguments.length;
      if (routine.uses_arguments) {
        a = [...arguments];
        for (i = k = 0, ref1 = a.length - 1; k <= ref1; i = k += 1) {
          if (a[i] == null) {
            a[i] = 0;
          }
        }
        proc.stack[++proc.stack_index] = a;
      }
      return proc.run(context);
    };
    //res = proc.stack[0]
    return f;
  }

  routineAsApplicableFunction(routine, context) {
    var f, proc;
    proc = new Processor(this.runner);
    f = function() {
      var a, count, i, j, k, ref, ref1, res;
      count = routine.num_args;
      proc.load(routine);
      proc.object = this;
      for (i = j = 0, ref = count - 1; j <= ref; i = j += 1) {
        proc.stack[++proc.stack_index] = arguments[i] || 0;
      }
      proc.stack[++proc.stack_index] = arguments.length;
      if (routine.uses_arguments) {
        a = [...arguments];
        for (i = k = 0, ref1 = a.length - 1; k <= ref1; i = k += 1) {
          if (a[i] == null) {
            a[i] = 0;
          }
        }
        proc.stack[++proc.stack_index] = a;
      }
      proc.run(context);
      return res = proc.stack[0];
    };
    return f;
  }

  argToNative(arg, context) {
    if (arg instanceof Routine) {
      return this.routineAsFunction(arg, context);
    } else {
      if (arg != null) {
        return arg;
      } else {
        return 0;
      }
    }
  }

  modulo(context, a, b) {
    var f, obj;
    if (Array.isArray(a)) {
      obj = context.global.List;
    } else if (typeof a === "string") {
      if (isFinite(a)) {
        a %= b;
        if (isFinite(a)) {
          return a;
        } else {
          return 0;
        }
      } else {
        obj = context.global.String;
      }
    } else {
      obj = a;
    }
    f = obj["%"];
    while ((f == null) && (obj.class != null)) {
      obj = obj.class;
      f = obj["%"];
    }
    if (f == null) {
      f = context.global.Object["%"];
    }
    if ((f != null) && f instanceof Routine) {
      if (f.as_function == null) {
        f.as_function = this.routineAsApplicableFunction(f, context);
      }
      f = f.as_function;
      return f.call(context.global, a, b);
    } else {
      return 0;
    }
  }

  add(context, a, b, self) {
    var f, obj;
    if (Array.isArray(a)) {
      obj = context.global.List;
    } else if (typeof a === "string") {
      obj = context.global.String;
    } else {
      obj = a;
    }
    f = obj["+"];
    while ((f == null) && (obj.class != null)) {
      obj = obj.class;
      f = obj["+"];
    }
    if (f == null) {
      f = context.global.Object["+"];
    }
    if (f != null) {
      if (f instanceof Routine) {
        if (f.as_function == null) {
          f.as_function = this.routineAsApplicableFunction(f, context);
        }
        f = f.as_function;
        return f.call(context.global, a, b, self);
      } else if (typeof f === "function") {
        return f.call(context.global, a, b, self);
      }
    } else {
      return 0;
    }
  }

  sub(context, a, b, self) {
    var f, obj;
    if (Array.isArray(a)) {
      obj = context.global.List;
    } else if (typeof a === "string") {
      if (isFinite(a)) {
        a -= b;
        if (isFinite(a)) {
          return a;
        } else {
          return 0;
        }
      } else {
        obj = context.global.String;
      }
    } else {
      obj = a;
    }
    f = obj["-"];
    while ((f == null) && (obj.class != null)) {
      obj = obj.class;
      f = obj["-"];
    }
    if (f == null) {
      f = context.global.Object["-"];
    }
    if (f != null) {
      if (f instanceof Routine) {
        if (f.as_function == null) {
          f.as_function = this.routineAsApplicableFunction(f, context);
        }
        f = f.as_function;
        return f.call(context.global, a, b, self);
      } else if (typeof f === "function") {
        return f.call(context.global, a, b, self);
      }
    } else {
      return 0;
    }
  }

  negate(context, a) {
    var f, obj;
    if (Array.isArray(a)) {
      obj = context.global.List;
    } else if (typeof a === "string") {
      if (isFinite(a)) {
        return -a;
      } else {
        obj = context.global.String;
      }
    } else {
      obj = a;
    }
    f = obj["-"];
    while ((f == null) && (obj.class != null)) {
      obj = obj.class;
      f = obj["-"];
    }
    if (f == null) {
      f = context.global.Object["-"];
    }
    if (f != null) {
      if (f instanceof Routine) {
        if (f.as_function == null) {
          f.as_function = this.routineAsApplicableFunction(f, context);
        }
        f = f.as_function;
        return f.call(context.global, 0, a);
      } else if (typeof f === "function") {
        return f.call(context.global, 0, a);
      }
    } else {
      return 0;
    }
  }

  mul(context, a, b, self) {
    var f, obj;
    if (Array.isArray(a)) {
      obj = context.global.List;
    } else if (typeof a === "string") {
      if (isFinite(a)) {
        a *= b;
        if (isFinite(a)) {
          return a;
        } else {
          return 0;
        }
      } else {
        obj = context.global.String;
      }
    } else {
      obj = a;
    }
    f = obj["*"];
    while ((f == null) && (obj.class != null)) {
      obj = obj.class;
      f = obj["*"];
    }
    if (f == null) {
      f = context.global.Object["*"];
    }
    if (f != null) {
      if (f instanceof Routine) {
        if (f.as_function == null) {
          f.as_function = this.routineAsApplicableFunction(f, context);
        }
        f = f.as_function;
        return f.call(context.global, a, b, self);
      } else if (typeof f === "function") {
        return f.call(context.global, a, b, self);
      }
    } else {
      return 0;
    }
  }

  div(context, a, b, self) {
    var f, obj;
    if (Array.isArray(a)) {
      obj = context.global.List;
    } else if (typeof a === "string") {
      if (isFinite(a)) {
        a /= b;
        if (isFinite(a)) {
          return a;
        } else {
          return 0;
        }
      } else {
        obj = context.global.String;
      }
    } else {
      obj = a;
    }
    f = obj["/"];
    while ((f == null) && (obj.class != null)) {
      obj = obj.class;
      f = obj["/"];
    }
    if (f == null) {
      f = context.global.Object["/"];
    }
    if (f != null) {
      if (f instanceof Routine) {
        if (f.as_function == null) {
          f.as_function = this.routineAsApplicableFunction(f, context);
        }
        f = f.as_function;
        return f.call(context.global, a, b, self);
      } else if (typeof f === "function") {
        return f.call(context.global, a, b, self);
      }
    } else {
      return 0;
    }
  }

  band(context, a, b, self) {
    var f, obj;
    if (Array.isArray(a)) {
      obj = context.global.List;
    } else if (typeof a === "string") {
      if (isFinite(a)) {
        a &= b;
        if (isFinite(a)) {
          return a;
        } else {
          return 0;
        }
      } else {
        obj = context.global.String;
      }
    } else {
      obj = a;
    }
    f = obj["&"];
    while ((f == null) && (obj.class != null)) {
      obj = obj.class;
      f = obj["&"];
    }
    if (f == null) {
      f = context.global.Object["&"];
    }
    if (f != null) {
      if (f instanceof Routine) {
        if (f.as_function == null) {
          f.as_function = this.routineAsApplicableFunction(f, context);
        }
        f = f.as_function;
        return f.call(context.global, a, b, self);
      } else if (typeof f === "function") {
        return f.call(context.global, a, b, self);
      }
    } else {
      return 0;
    }
  }

  bor(context, a, b, self) {
    var f, obj;
    if (Array.isArray(a)) {
      obj = context.global.List;
    } else if (typeof a === "string") {
      if (isFinite(a)) {
        a |= b;
        if (isFinite(a)) {
          return a;
        } else {
          return 0;
        }
      } else {
        obj = context.global.String;
      }
    } else {
      obj = a;
    }
    f = obj["|"];
    while ((f == null) && (obj.class != null)) {
      obj = obj.class;
      f = obj["|"];
    }
    if (f == null) {
      f = context.global.Object["|"];
    }
    if (f != null) {
      if (f instanceof Routine) {
        if (f.as_function == null) {
          f.as_function = this.routineAsApplicableFunction(f, context);
        }
        f = f.as_function;
        return f.call(context.global, a, b, self);
      } else if (typeof f === "function") {
        return f.call(context.global, a, b, self);
      }
    } else {
      return 0;
    }
  }

  run(context) {
    var a, arg1, args, argv, b, c, call_stack, call_stack_index, call_super, call_supername, con, cs, err, f, fc, field, global, i, i1, i2, id, index, ir, iter, iterator, j, k, key, l, len, length, local_index, locals, locals_offset, loop_by, loop_to, m, n, name, o, obj, object, op_count, op_index, opcodes, p, parent, q, r, rc, ref, ref1, ref10, ref11, ref12, ref13, ref14, ref2, ref3, ref4, ref5, ref6, ref7, ref8, ref9, res, restore_op_index, routine, s, sleep_time, src, stack, stack_index, sup, t, token, u, v, value, w;
    routine = this.routine;
    opcodes = this.routine.opcodes;
    arg1 = this.routine.arg1;
    length = opcodes.length;
    op_index = this.op_index;
    stack = this.stack;
    stack_index = this.stack_index;
    locals = this.locals;
    local_index = this.local_index;
    global = this.global || context.global;
    object = this.object || global;
    call_stack = this.call_stack;
    call_stack_index = this.call_stack_index;
    call_super = this.call_super || global;
    call_supername = this.call_supername || "";
    locals_offset = this.locals_offset;
    op_count = 0;
    restore_op_index = -1;
    while (op_index < length) {
      switch (opcodes[op_index]) {
        case 1: // OPCODE_TYPE
          v = stack[stack_index];
          switch (typeof v) {
            case "number":
              stack[stack_index] = "number";
              break;
            case "string":
              stack[stack_index] = "string";
              break;
            case "function":
              stack[stack_index] = "function";
              break;
            case "object":
              if (Array.isArray(v)) {
                stack[stack_index] = "list";
              } else if (v instanceof Routine) {
                stack[stack_index] = "function";
              } else {
                stack[stack_index] = "object";
              }
          }
          op_index++;
          break;
        case 2: // OPCODE_TYPE_VARIABLE
          v = object[arg1[op_index]];
          if (v == null) {
            v = global[arg1[op_index]];
          }
          if (v == null) {
            stack[++stack_index] = 0;
          } else {
            switch (typeof v) {
              case "number":
                stack[++stack_index] = "number";
                break;
              case "string":
                stack[++stack_index] = "string";
                break;
              case "function":
                stack[++stack_index] = "function";
                break;
              default:
                if (Array.isArray(v)) {
                  stack[++stack_index] = "list";
                } else if (v instanceof Routine) {
                  stack[++stack_index] = "function";
                } else {
                  stack[++stack_index] = "object";
                }
            }
          }
          op_index++;
          break;
        case 3: // OPCODE_TYPE_PROPERTY
          v = stack[stack_index - 1][stack[stack_index]];
          if (v == null) {
            stack[--stack_index] = 0;
          } else {
            switch (typeof v) {
              case "number":
                stack[--stack_index] = "number";
                break;
              case "string":
                stack[--stack_index] = "string";
                break;
              case "function":
                stack[--stack_index] = "function";
                break;
              default:
                if (Array.isArray(v)) {
                  stack[--stack_index] = "list";
                } else if (v instanceof Routine) {
                  stack[--stack_index] = "function";
                } else {
                  stack[--stack_index] = "object";
                }
            }
          }
          op_index++;
          break;
        case 4: // OPCODE_LOAD_IMPORT
          stack[++stack_index] = routine.import_values[arg1[op_index++]];
          break;
        case 5: // OPCODE_LOAD_THIS
          stack[++stack_index] = object;
          op_index++;
          break;
        case 6: // OPCODE_LOAD_GLOBAL
          stack[++stack_index] = global;
          op_index++;
          break;
        case 10: // CODE_LOAD_VALUE
          stack[++stack_index] = arg1[op_index++];
          break;
        case 11: // OPCODE_LOAD_LOCAL
          stack[++stack_index] = locals[locals_offset + arg1[op_index++]];
          break;
        case 12: // OPCODE_LOAD_VARIABLE
          name = arg1[op_index];
          v = object[name];
          if ((v == null) && (object.class != null)) {
            obj = object;
            while ((v == null) && (obj.class != null)) {
              obj = obj.class;
              v = obj[name];
            }
          }
          if (v == null) {
            v = global[name];
          }
          if ((v == null) && !routine.ref[op_index].nowarning) {
            token = routine.ref[op_index].token;
            id = token.tokenizer.filename + "-" + token.line + "-" + token.column;
            if (!context.warnings.using_undefined_variable[id]) {
              context.warnings.using_undefined_variable[id] = {
                file: token.tokenizer.filename,
                line: token.line,
                column: token.column,
                expression: name
              };
            }
          }
          stack[++stack_index] = v != null ? v : 0;
          op_index++;
          break;
        case 13: // OPCODE_LOAD_LOCAL_OBJECT
          o = locals[locals_offset + arg1[op_index]];
          if (typeof o !== "object") {
            o = locals[locals_offset + arg1[op_index]] = {};
            token = routine.ref[op_index].token;
            id = token.tokenizer.filename + "-" + token.line + "-" + token.column;
            if (!context.warnings.assigning_field_to_undefined[id]) {
              context.warnings.assigning_field_to_undefined[id] = {
                file: token.tokenizer.filename,
                line: token.line,
                column: token.column,
                expression: token.value
              };
            }
          }
          stack[++stack_index] = o;
          op_index++;
          break;
        case 14: // OPCODE_LOAD_VARIABLE_OBJECT
          name = arg1[op_index];
          obj = object;
          v = obj[name];
          while ((v == null) && (obj.class != null)) {
            obj = obj.class;
            v = obj[name];
          }
          if ((v == null) && (global[name] != null)) {
            obj = global;
            v = global[name];
          }
          if ((v == null) || typeof v !== "object") {
            v = obj[name] = {};
            token = routine.ref[op_index].token;
            id = token.tokenizer.filename + "-" + token.line + "-" + token.column;
            if (!context.warnings.assigning_field_to_undefined[id]) {
              context.warnings.assigning_field_to_undefined[id] = {
                file: token.tokenizer.filename,
                line: token.line,
                column: token.column,
                expression: arg1[op_index]
              };
            }
          }
          stack[++stack_index] = v;
          op_index++;
          break;
        case 15: // OPCODE_POP
          stack_index--;
          op_index++;
          break;
        case 16: // OPCODE_LOAD_PROPERTY
          obj = stack[stack_index - 1];
          name = stack[stack_index];
          v = obj[name];
          while ((v == null) && (obj.class != null)) {
            obj = obj.class;
            v = obj[name];
          }
          if (v == null) {
            v = 0;
            if (!routine.ref[op_index].nowarning) {
              routine.ref[op_index].nowarning = true;
              if (!Array.isArray(obj)) {
                token = routine.ref[op_index].token;
                id = token.tokenizer.filename + "-" + token.line + "-" + token.column;
                context.warnings.using_undefined_variable[id] = {
                  file: token.tokenizer.filename,
                  line: token.line,
                  column: token.column,
                  expression: name
                };
              }
            }
          }
          stack[--stack_index] = v;
          op_index++;
          break;
        case 17: // OPCODE_LOAD_PROPERTY_OBJECT
          v = stack[stack_index - 1][stack[stack_index]];
          if (typeof v !== "object") {
            v = stack[stack_index - 1][stack[stack_index]] = {};
            token = routine.ref[op_index].token;
            id = token.tokenizer.filename + "-" + token.line + "-" + token.column;
            if (!context.warnings.assigning_field_to_undefined[id]) {
              context.warnings.assigning_field_to_undefined[id] = {
                file: token.tokenizer.filename,
                line: token.line,
                column: token.column,
                expression: stack[stack_index]
              };
            }
          }
          stack[--stack_index] = v;
          op_index++;
          break;
        case 18: // OPCODE_CREATE_OBJECT
          stack[++stack_index] = {};
          op_index++;
          break;
        case 19: // OPCODE_MAKE_OBJECT
          if (typeof stack[stack_index] !== "object") {
            stack[stack_index] = {};
          }
          op_index++;
          break;
        case 20: // OPCODE_CREATE_ARRAY
          stack[++stack_index] = [];
          op_index++;
          break;
        case 21: // OPCODE_STORE_LOCAL
          locals[locals_offset + arg1[op_index]] = stack[stack_index];
          op_index++;
          break;
        case 22: // OPCODE_STORE_LOCAL_POP
          locals[locals_offset + arg1[op_index]] = stack[stack_index--];
          op_index++;
          break;
        case 23: // OPCODE_STORE_VARIABLE
          object[arg1[op_index++]] = stack[stack_index];
          break;
        case 24: // OPCODE_CREATE_PROPERTY
          obj = stack[stack_index - 2];
          field = stack[stack_index - 1];
          obj[field] = stack[stack_index];
          stack_index -= 2;
          op_index++;
          break;
        case 25: // OPCODE_STORE_PROPERTY
          obj = stack[stack_index - 2];
          field = stack[stack_index - 1];
          stack[stack_index - 2] = obj[field] = stack[stack_index];
          stack_index -= 2;
          op_index++;
          break;
        case 26: // OPCODE_DELETE
          obj = stack[stack_index - 1];
          field = stack[stack_index];
          delete obj[field];
          stack[stack_index -= 1] = 0;
          op_index++;
          break;
        case 27: // OPCODE_UPDATE_CLASS
          name = arg1[op_index];
          // TODO: set classname to variable name
          if ((object[name] != null) && typeof object[name] === "object") {
            obj = object[name];
            src = stack[stack_index];
            for (key in src) {
              value = src[key];
              obj[key] = value;
            }
          } else {
            object[name] = stack[stack_index];
          }
          op_index++;
          break;
        case 28: // OPCODE_CREATE_CLASS
          res = {};
          parent = stack[stack_index];
          if (parent) {
            res.class = parent;
          } else if (arg1[op_index]) {
            res.class = arg1[op_index];
          }
          stack[stack_index] = res;
          op_index++;
          break;
        case 29: // OPCODE_NEW_CALL
          c = stack[stack_index];
          args = arg1[op_index];
          if (typeof c === "function") {
            a = [];
            for (i = j = 0, ref = args - 1; j <= ref; i = j += 1) {
              a.push(stack[stack_index - args + i]);
            }
            stack_index -= args;
            // NEW CALL is followed by a POP (to get rid of constructor return value)
            stack[stack_index - 1] = new c(...a);
            op_index++;
          } else {
            this.resolveParentClass(c, global);
            res = {
              class: c
            };
            con = c.constructor;
            while (!con && (c.class != null)) {
              c = c.class;
              con = c.constructor;
            }
            if ((con != null) && con instanceof Routine) {
              stack[stack_index - args - 1] = res;
              stack_index--;
              cs = call_stack[call_stack_index] || (call_stack[call_stack_index] = {});
              call_stack_index++;
              cs.routine = routine;
              cs.object = object;
              cs.super = call_super;
              cs.supername = call_supername;
              cs.op_index = op_index + 1;
              locals_offset += routine.locals_size;
              routine = con;
              opcodes = con.opcodes;
              arg1 = con.arg1;
              op_index = 0;
              length = opcodes.length;
              object = res;
              call_super = c;
              call_supername = "constructor";
              if (routine.uses_arguments) {
                argv = stack.slice(stack_index - args + 1, stack_index + 1);
              }
              if (args < con.num_args) {
                for (i = k = ref1 = args + 1, ref2 = con.num_args; k <= ref2; i = k += 1) {
                  stack[++stack_index] = 0;
                }
              } else if (args > con.num_args) {
                stack_index -= args - con.num_args;
              }
              stack[++stack_index] = args;
              if (routine.uses_arguments) {
                stack[++stack_index] = argv;
              }
            } else {
              stack_index -= args;
              stack[stack_index - 1] = res;
              op_index++;
            }
          }
          break;
        case 30: // OPCODE_ADD
          b = stack[stack_index--];
          a = stack[stack_index];
          if (typeof a === "number") {
            a += b;
            stack[stack_index] = isFinite(a) || typeof b === "string" ? a : 0;
          } else {
            stack[stack_index] = this.add(context, a, b, arg1[op_index]);
          }
          op_index++;
          break;
        case 31: // OPCODE_SUB
          b = stack[stack_index--];
          a = stack[stack_index];
          if (typeof a === "number") {
            a -= b;
            stack[stack_index] = isFinite(a) ? a : 0;
          } else {
            stack[stack_index] = this.sub(context, a, b, arg1[op_index]);
          }
          op_index++;
          break;
        case 32: // OPCODE_MUL
          b = stack[stack_index--];
          a = stack[stack_index];
          if (typeof a === "number") {
            a *= b;
            stack[stack_index] = isFinite(a) ? a : 0;
          } else {
            stack[stack_index] = this.mul(context, a, b);
          }
          op_index++;
          break;
        case 33: // OPCODE_DIV
          b = stack[stack_index--];
          a = stack[stack_index];
          if (typeof a === "number") {
            a /= b;
            stack[stack_index] = isFinite(a) ? a : 0;
          } else {
            stack[stack_index] = this.div(context, a, b);
          }
          op_index++;
          break;
        case 34: // OPCODE_MODULO
          b = stack[stack_index--];
          a = stack[stack_index];
          if (typeof a === "number" && typeof b === "number") {
            a %= b;
            stack[stack_index] = isFinite(a) ? a : 0;
          } else {
            stack[stack_index] = this.modulo(context, a, b);
          }
          op_index++;
          break;
        case 35: // OPCODE_BINARY_AND
          b = stack[stack_index--];
          a = stack[stack_index];
          if (typeof a === "number") {
            a &= b;
            stack[stack_index] = isFinite(a) ? a : 0;
          } else {
            stack[stack_index] = this.band(context, a, b);
          }
          op_index++;
          break;
        case 36: // OPCODE_BINARY_OR
          b = stack[stack_index--];
          a = stack[stack_index];
          if (typeof a === "number") {
            a |= b;
            stack[stack_index] = isFinite(a) ? a : 0;
          } else {
            stack[stack_index] = this.bor(context, a, b);
          }
          op_index++;
          break;
        case 37: // OPCODE_SHIFT_LEFT
          v = stack[stack_index - 1] << stack[stack_index];
          stack[--stack_index] = isFinite(v) ? v : 0;
          op_index++;
          break;
        case 38: // OPCODE_SHIFT_RIGHT
          v = stack[stack_index - 1] >> stack[stack_index];
          stack[--stack_index] = isFinite(v) ? v : 0;
          op_index++;
          break;
        case 39: // OPCODE_NEGATE
          a = stack[stack_index];
          if (typeof a === "number") {
            stack[stack_index] = -a;
          } else {
            stack[stack_index] = this.negate(context, a);
          }
          op_index++;
          break;
        case 50: // OPCODE_NOT
          stack[stack_index] = stack[stack_index] ? 0 : 1;
          op_index++;
          break;
        case 68: // OPCODE_LOAD_PROPERTY_ATOP
          obj = stack[stack_index - 1];
          name = stack[stack_index];
          v = obj[name];
          while ((v == null) && (obj.class != null)) {
            obj = obj.class;
            v = obj[name];
          }
          if (v == null) {
            v = 0;
            if (!routine.ref[op_index].nowarning) {
              routine.ref[op_index].nowarning = true;
              if (!Array.isArray(obj)) {
                token = routine.ref[op_index].token;
                id = token.tokenizer.filename + "-" + token.line + "-" + token.column;
                context.warnings.using_undefined_variable[id] = {
                  file: token.tokenizer.filename,
                  line: token.line,
                  column: token.column,
                  expression: name
                };
              }
            }
          }
          stack[++stack_index] = v;
          op_index++;
          break;
        case 40: // OPCODE_EQ
          stack[stack_index - 1] = stack[stack_index] === stack[stack_index - 1] ? 1 : 0;
          stack_index--;
          op_index++;
          break;
        case 41: // OPCODE_NEQ
          stack[stack_index - 1] = stack[stack_index] !== stack[stack_index - 1] ? 1 : 0;
          stack_index--;
          op_index++;
          break;
        case 42: // OPCODE_LT
          stack[stack_index - 1] = stack[stack_index - 1] < stack[stack_index] ? 1 : 0;
          stack_index--;
          op_index++;
          break;
        case 43: // OPCODE_GT
          stack[stack_index - 1] = stack[stack_index - 1] > stack[stack_index] ? 1 : 0;
          stack_index--;
          op_index++;
          break;
        case 44: // OPCODE_LTE
          stack[stack_index - 1] = stack[stack_index - 1] <= stack[stack_index] ? 1 : 0;
          stack_index--;
          op_index++;
          break;
        case 45: // OPCODE_GTE
          stack[stack_index - 1] = stack[stack_index - 1] >= stack[stack_index] ? 1 : 0;
          stack_index--;
          op_index++;
          break;
        case 95: // FORLOOP_INIT
          // fix loop_by if not set
          iter = arg1[op_index][0];
          loop_to = locals[locals_offset + iter + 1] = stack[stack_index - 1];
          loop_by = stack[stack_index];
          iterator = locals[locals_offset + iter];
          stack[--stack_index] = 0; // unload 2 values and load default value
          if (loop_by === 0) {
            locals[locals_offset + iter + 2] = loop_to > iterator ? 1 : -1;
            op_index++;
          } else {
            locals[locals_offset + iter + 2] = loop_by;
            if ((loop_by > 0 && iterator > loop_to) || (loop_by < 0 && iterator < loop_to)) {
              op_index = arg1[op_index][1];
            } else {
              op_index++;
            }
          }
          break;
        case 96: // FORLOOP_CONTROL
          iter = arg1[op_index][0];
          loop_by = locals[locals_offset + iter + 2];
          loop_to = locals[locals_offset + iter + 1];
          iterator = locals[locals_offset + iter];
          iterator += loop_by;
          if ((loop_by > 0 && iterator > loop_to) || (loop_by < 0 && iterator < loop_to)) {
            op_index++;
          } else {
            locals[locals_offset + iter] = iterator;
            op_index = arg1[op_index][1];
          }
          if (op_count++ > 100) {
            op_count = 0;
            if (Date.now() > this.time_limit) {
              restore_op_index = op_index;
              op_index = length; // stop the loop without adding a condition statement
            }
          }
          break;
        case 97: // FORIN_INIT
          v = stack[stack_index];
          stack[stack_index] = 0; // default result
          iterator = arg1[op_index][0];
          if (typeof v === "object") {
            if (Array.isArray(v)) {
              locals[locals_offset + iterator + 1] = v;
            } else {
              v = locals[locals_offset + iterator + 1] = Object.keys(v);
            }
          } else if (typeof v === "string") {
            v = locals[locals_offset + iterator + 1] = v.split("");
          } else {
            v = locals[locals_offset + iterator + 1] = [];
          }
          if (v.length === 0) {
            op_index = arg1[op_index][1];
          } else {
            value = v[0];
            // value could be undefined if the array is sparse
            locals[locals_offset + arg1[op_index][0]] = value != null ? value : 0;
            locals[locals_offset + iterator + 2] = 0;
            op_index++;
          }
          break;
        case 98: // FORIN_CONTROL
          iterator = arg1[op_index][0];
          index = locals[locals_offset + iterator + 2] += 1;
          v = locals[locals_offset + iterator + 1];
          if (index < v.length) {
            value = v[index];
            // value could be undefined if the array is sparse
            locals[locals_offset + iterator] = value != null ? value : 0;
            op_index = arg1[op_index][1];
          } else {
            op_index++;
          }
          if (op_count++ > 100) {
            op_count = 0;
            if (Date.now() > this.time_limit) {
              restore_op_index = op_index;
              op_index = length; // stop the loop without adding a condition statement
            }
          }
          break;
        case 80: // OPCODE_JUMP
          op_index = arg1[op_index];
          if (op_count++ > 100) {
            op_count = 0;
            if (Date.now() > this.time_limit) {
              restore_op_index = op_index;
              op_index = length; // stop the loop without adding a condition statement
            }
          }
          break;
        case 81: // OPCODE_JUMPY
          if (stack[stack_index--]) {
            op_index = arg1[op_index];
          } else {
            op_index++;
          }
          break;
        case 82: // OPCODE_JUMPN
          if (!stack[stack_index--]) {
            op_index = arg1[op_index];
          } else {
            op_index++;
          }
          break;
        case 83: // OPCODE_JUMPY_NOPOP
          if (stack[stack_index]) {
            op_index = arg1[op_index];
          } else {
            op_index++;
          }
          break;
        case 84: // OPCODE_JUMPN_NOPOP
          if (!stack[stack_index]) {
            op_index = arg1[op_index];
          } else {
            op_index++;
          }
          break;
        case 89: // OPCODE_LOAD_ROUTINE
          r = arg1[op_index++];
          rc = r.clone();
          ref3 = r.import_refs;
          for (l = 0, len = ref3.length; l < len; l++) {
            ir = ref3[l];
            if (ir === r.import_self) {
              rc.import_values.push(rc);
            } else {
              rc.import_values.push(locals[locals_offset + ir]);
            }
          }
          rc.object = object;
          stack[++stack_index] = rc;
          break;
        case 90: // OPCODE_FUNCTION_CALL
          args = arg1[op_index];
          f = stack[stack_index];
          if (f instanceof Routine) {
            stack_index--;
            cs = call_stack[call_stack_index] || (call_stack[call_stack_index] = {});
            call_stack_index++;
            cs.routine = routine;
            cs.object = object;
            cs.super = call_super;
            cs.supername = call_supername;
            cs.op_index = op_index + 1;
            locals_offset += routine.locals_size;
            routine = f;
            opcodes = f.opcodes;
            arg1 = f.arg1;
            op_index = 0;
            length = opcodes.length;
            object = routine.object != null ? routine.object : global;
            call_super = global;
            call_supername = "";
            if (routine.uses_arguments) {
              argv = stack.slice(stack_index - args + 1, stack_index + 1);
            }
            if (args < f.num_args) {
              for (i = m = ref4 = args + 1, ref5 = f.num_args; m <= ref5; i = m += 1) {
                stack[++stack_index] = 0;
              }
            } else if (args > f.num_args) {
              stack_index -= args - f.num_args;
            }
            stack[++stack_index] = args;
            if (routine.uses_arguments) {
              stack[++stack_index] = argv;
            }
          } else if (typeof f === "function") {
            switch (args) {
              case 0:
                try {
                  v = f();
                } catch (error) {
                  err = error;
                  console.error(err);
                  v = 0;
                }
                stack[stack_index] = v != null ? v : 0;
                break;
              case 1:
                try {
                  v = f(this.argToNative(stack[stack_index - 1], context));
                } catch (error) {
                  err = error;
                  console.error(err);
                  v = 0;
                }
                stack[stack_index - 1] = v != null ? v : 0;
                stack_index -= 1;
                break;
              default:
                argv = [];
                stack_index -= args;
                for (i = n = 0, ref6 = args - 1; n <= ref6; i = n += 1) {
                  argv[i] = this.argToNative(stack[stack_index + i], context);
                }
                try {
                  v = f.apply(null, argv);
                } catch (error) {
                  err = error;
                  console.error(err);
                  v = 0;
                }
                stack[stack_index] = v != null ? v : 0;
            }
            op_index++;
          } else {
            stack_index -= args;
            stack[stack_index] = f != null ? f : 0;
            token = routine.ref[op_index].token;
            id = token.tokenizer.filename + "-" + token.line + "-" + token.column;
            if (!context.warnings.invoking_non_function[id]) {
              fc = routine.ref[op_index];
              i1 = fc.expression.token.start;
              i2 = fc.token.start + fc.token.length;
              context.warnings.invoking_non_function[id] = {
                file: token.tokenizer.filename,
                line: token.line,
                column: token.column,
                expression: fc.token.tokenizer.input.substring(i1, i2)
              };
            }
            op_index++;
          }
          break;
        case 91: // OPCODE_FUNCTION_APPLY_VARIABLE
          name = stack[stack_index];
          sup = obj = object;
          f = obj[name];
          if (f == null) {
            while ((f == null) && (sup.class != null)) {
              sup = sup.class;
              f = sup[name];
            }
            if (f == null) {
              f = global.Object[name];
            }
            if (f == null) {
              f = global[name];
              sup = global;
              obj = global;
            }
          }
          args = arg1[op_index];
          if (f instanceof Routine) {
            stack_index -= 1;
            cs = call_stack[call_stack_index] || (call_stack[call_stack_index] = {});
            call_stack_index++;
            cs.routine = routine;
            cs.object = object;
            cs.super = call_super;
            cs.supername = call_supername;
            cs.op_index = op_index + 1;
            locals_offset += routine.locals_size;
            routine = f;
            opcodes = f.opcodes;
            arg1 = f.arg1;
            op_index = 0;
            length = opcodes.length;
            object = obj;
            call_super = sup;
            call_supername = name;
            if (routine.uses_arguments) {
              argv = stack.slice(stack_index - args + 1, stack_index + 1);
            }
            if (args < f.num_args) {
              for (i = p = ref7 = args + 1, ref8 = f.num_args; p <= ref8; i = p += 1) {
                stack[++stack_index] = 0;
              }
            } else if (args > f.num_args) {
              stack_index -= args - f.num_args;
            }
            stack[++stack_index] = args;
            if (routine.uses_arguments) {
              stack[++stack_index] = argv;
            }
          } else if (typeof f === "function") {
            switch (args) {
              case 0:
                try {
                  v = f.call(obj);
                } catch (error) {
                  err = error;
                  console.error(err);
                  v = 0;
                }
                stack[stack_index] = v != null ? v : 0;
                break;
              case 1:
                try {
                  v = f.call(obj, this.argToNative(stack[stack_index - 1], context));
                } catch (error) {
                  err = error;
                  console.error(err);
                  v = 0;
                }
                stack[--stack_index] = v != null ? v : 0;
                break;
              default:
                argv = [];
                stack_index -= args;
                for (i = q = 0, ref9 = args - 1; q <= ref9; i = q += 1) {
                  argv[i] = this.argToNative(stack[stack_index + i], context);
                }
                try {
                  v = f.apply(obj, argv);
                } catch (error) {
                  err = error;
                  console.error(err);
                  v = 0;
                }
                stack[stack_index] = v != null ? v : 0;
            }
            op_index++;
          } else {
            stack_index -= args;
            stack[stack_index] = f != null ? f : 0;
            token = routine.ref[op_index].token;
            id = token.tokenizer.filename + "-" + token.line + "-" + token.column;
            if (!context.warnings.invoking_non_function[id]) {
              fc = routine.ref[op_index];
              i1 = fc.expression.token.start;
              i2 = fc.token.start + fc.token.length;
              context.warnings.invoking_non_function[id] = {
                file: token.tokenizer.filename,
                line: token.line,
                column: token.column,
                expression: fc.token.tokenizer.input.substring(i1, i2)
              };
            }
            op_index++;
          }
          break;
        case 92: // OPCODE_FUNCTION_APPLY_PROPERTY
          obj = stack[stack_index - 1];
          sup = obj;
          name = stack[stack_index];
          f = obj[name];
          while ((f == null) && (sup.class != null)) {
            sup = sup.class;
            f = sup[name];
          }
          args = arg1[op_index];
          if (f == null) {
            if (obj instanceof Routine) {
              f = global.Function[name];
            } else if (typeof obj === "string") {
              f = global.String[name];
            } else if (typeof obj === "number") {
              f = global.Number[name];
            } else if (Array.isArray(obj)) {
              f = global.List[name];
            } else if (typeof obj === "object") {
              f = global.Object[name];
            }
          }
          if (f instanceof Routine) {
            stack_index -= 2;
            cs = call_stack[call_stack_index] || (call_stack[call_stack_index] = {});
            call_stack_index++;
            cs.object = object;
            cs.super = call_super;
            cs.supername = call_supername;
            cs.routine = routine;
            cs.op_index = op_index + 1;
            locals_offset += routine.locals_size;
            routine = f;
            opcodes = f.opcodes;
            arg1 = f.arg1;
            op_index = 0;
            length = opcodes.length;
            object = obj;
            call_super = sup;
            call_supername = name;
            if (routine.uses_arguments) {
              argv = stack.slice(stack_index - args + 1, stack_index + 1);
            }
            if (args < f.num_args) {
              for (i = s = ref10 = args + 1, ref11 = f.num_args; s <= ref11; i = s += 1) {
                stack[++stack_index] = 0;
              }
            } else if (args > f.num_args) {
              stack_index -= args - f.num_args;
            }
            stack[++stack_index] = args;
            if (routine.uses_arguments) {
              stack[++stack_index] = argv;
            }
          } else if (typeof f === "function") {
            switch (args) {
              case 0:
                try {
                  v = f.call(obj);
                } catch (error) {
                  err = error;
                  console.error(err);
                  v = 0;
                }
                stack[--stack_index] = v != null ? v : 0;
                break;
              case 1:
                try {
                  v = f.call(obj, this.argToNative(stack[stack_index - 2], context));
                } catch (error) {
                  err = error;
                  console.error(err);
                  v = 0;
                }
                stack[stack_index - 2] = v != null ? v : 0;
                stack_index -= 2;
                break;
              default:
                argv = [];
                stack_index -= args + 1;
                for (i = u = 0, ref12 = args - 1; u <= ref12; i = u += 1) {
                  argv[i] = this.argToNative(stack[stack_index + i], context);
                }
                try {
                  v = f.apply(obj, argv);
                } catch (error) {
                  err = error;
                  console.error(err);
                  v = 0;
                }
                stack[stack_index] = v != null ? v : 0;
            }
            op_index++;
          } else {
            stack_index -= args + 1;
            stack[stack_index] = f != null ? f : 0;
            token = routine.ref[op_index].token;
            id = token.tokenizer.filename + "-" + token.line + "-" + token.column;
            if (!context.warnings.invoking_non_function[id]) {
              fc = routine.ref[op_index];
              i1 = fc.expression.token.start;
              i2 = fc.token.start + fc.token.length;
              context.warnings.invoking_non_function[id] = {
                file: token.tokenizer.filename,
                line: token.line,
                column: token.column,
                expression: fc.token.tokenizer.input.substring(i1, i2)
              };
            }
            op_index++;
          }
          break;
        case 93: // OPCODE_SUPER_CALL
          if ((call_super != null) && (call_supername != null)) {
            sup = call_super;
            f = null;
            while ((f == null) && (sup.class != null)) {
              sup = sup.class;
              f = sup[call_supername];
            }
            if ((f != null) && f instanceof Routine) {
              args = arg1[op_index];
              cs = call_stack[call_stack_index] || (call_stack[call_stack_index] = {});
              call_stack_index++;
              cs.object = object;
              cs.super = call_super;
              cs.supername = call_supername;
              cs.routine = routine;
              cs.op_index = op_index + 1;
              locals_offset += routine.locals_size;
              routine = f;
              opcodes = f.opcodes;
              arg1 = f.arg1;
              op_index = 0;
              length = opcodes.length;
              call_super = sup;
              if (routine.uses_arguments) {
                argv = stack.slice(stack_index - args + 1, stack_index + 1);
              }
              if (args < f.num_args) {
                for (i = w = ref13 = args + 1, ref14 = f.num_args; w <= ref14; i = w += 1) {
                  stack[++stack_index] = 0;
                }
              } else if (args > f.num_args) {
                stack_index -= args - f.num_args;
              }
              stack[++stack_index] = args;
              if (routine.uses_arguments) {
                stack[++stack_index] = argv;
              }
            } else {
              args = arg1[op_index];
              stack_index -= args;
              stack[++stack_index] = 0;
              op_index++;
            }
          } else {
            args = arg1[op_index];
            stack_index -= args;
            stack[++stack_index] = 0;
            op_index++;
          }
          break;
        case 94: // OPCODE_RETURN
          local_index -= arg1[op_index];
          if (call_stack_index <= 0) {
            op_index = length;
          } else {
            cs = call_stack[--call_stack_index];
            object = cs.object;
            call_super = cs.super;
            call_supername = cs.supername;
            routine = cs.routine;
            op_index = cs.op_index;
            opcodes = routine.opcodes;
            arg1 = routine.arg1;
            locals_offset -= routine.locals_size;
            length = opcodes.length;
          }
          break;
        case 100: // OPCODE_UNARY_FUNC
          v = arg1[op_index](stack[stack_index]);
          stack[stack_index] = isFinite(v) ? v : 0;
          op_index++;
          break;
        case 101: // OPCODE_BINARY_FUNC
          v = arg1[op_index](stack[stack_index - 1], stack[stack_index]);
          stack[--stack_index] = isFinite(v) ? v : 0;
          op_index++;
          break;
        case 110: // OPCODE_AFTER
          t = this.runner.createThread(stack[stack_index - 1], stack[stack_index], false);
          stack[--stack_index] = t;
          op_index += 1;
          break;
        // add thread to the runner thread list
        case 111: // OPCODE_EVERY
          t = this.runner.createThread(stack[stack_index - 1], stack[stack_index], true);
          stack[--stack_index] = t;
          op_index += 1;
          break;
        // add thread to the runner thread list
        case 112: // OPCODE_DO
          t = this.runner.createThread(stack[stack_index], 0, false);
          stack[stack_index] = t;
          op_index += 1;
          break;
        // add thread to the runner thread list
        case 113: // OPCODE_SLEEP
          sleep_time = isFinite(stack[stack_index]) ? stack[stack_index] : 0;
          this.runner.sleep(sleep_time);
          op_index += 1;
          restore_op_index = op_index;
          op_index = length; // stop the thread
          break;
        case 200: // COMPILED
          stack_index = arg1[op_index](stack, stack_index, locals, locals_offset, object, global);
          op_index++;
          break;
        default:
          throw `Unsupported operation: ${opcodes[op_index]}`;
      }
    }
    if (restore_op_index >= 0) {
      this.op_index = restore_op_index;
      this.routine = routine;
      this.stack_index = stack_index;
      this.local_index = local_index;
      this.object = object;
      this.call_stack_index = call_stack_index;
      this.call_super = call_super;
      this.call_supername = call_supername;
      this.locals_offset = locals_offset;
      this.done = false;
    } else {
      this.op_index = 0;
      this.done = true;
      if (this.routine.callback != null) {
        this.routine.callback(stack[stack_index]);
        this.routine.callback = null;
      }
    }
    // console.info """stack_index: #{stack_index}"""
    // console.info stack
    if (this.log) {
      console.info("total operations: " + op_count);
      console.info(`stack_index: ${stack_index}`);
      console.info(`result: ${stack[stack_index]}`);
    }
    return stack[stack_index];
  }

};


this.Program = class Program {
  constructor() {
    this.statements = [];
  }

  add(statement) {
    return this.statements.push(statement);
  }

  isAssignment() {
    return this.statements.length > 0 && this.statements[this.statements.length - 1] instanceof Program.Assignment;
  }

};

this.Program.Expression = class Expression {
  constructor() {}

};

this.Program.Assignment = class Assignment {
  constructor(token1, field1, expression1, local) {
    this.token = token1;
    this.field = field1;
    this.expression = expression1;
    this.local = local;
  }

};

this.Program.SelfAssignment = class SelfAssignment {
  constructor(token1, field1, operation, expression1) {
    this.token = token1;
    this.field = field1;
    this.operation = operation;
    this.expression = expression1;
  }

};

this.Program.Value = (function() {
  class Value {
    constructor(token1, type, value1) {
      this.token = token1;
      this.type = type;
      this.value = value1;
    }

  };

  Value.TYPE_NUMBER = 1;

  Value.TYPE_STRING = 2;

  Value.TYPE_ARRAY = 3;

  Value.TYPE_OBJECT = 4;

  Value.TYPE_FUNCTION = 5;

  Value.TYPE_CLASS = 6;

  return Value;

}).call(this);

this.Program.CreateFieldAccess = function(token, expression, field) {
  if (expression instanceof Program.Field) {
    expression.appendField(field);
    return expression;
  } else {
    return new Program.Field(token, expression, [field]);
  }
};

this.Program.Variable = class Variable {
  constructor(token1, identifier) {
    this.token = token1;
    this.identifier = identifier;
  }

};

this.Program.Field = class Field {
  constructor(token1, expression1, chain) {
    this.token = token1;
    this.expression = expression1;
    this.chain = chain;
    this.token = this.expression.token;
  }

  appendField(field) {
    return this.chain.push(field);
  }

};

this.Program.BuildOperations = function(ops, terms) {
  var i, o, o1, o2, prec, t1, t2;
  while (ops.length > 1) {
    i = 0;
    prec = 0;
    while (i < ops.length - 1) {
      o1 = ops[i];
      o2 = ops[i + 1];
      if (Program.Precedence[o2.operation] <= Program.Precedence[o1.operation]) {
        break;
      }
      i++;
    }
    t1 = terms[i];
    t2 = terms[i + 1];
    o = new Program.Operation(ops[i].token, ops[i].operation, t1, t2);
    terms.splice(i, 2, o);
    ops.splice(i, 1);
  }
  return new Program.Operation(ops[0].token, ops[0].operation, terms[0], terms[1]);
};

this.Program.Operation = class Operation {
  constructor(token1, operation, term1, term2) {
    this.token = token1;
    this.operation = operation;
    this.term1 = term1;
    this.term2 = term2;
  }

};

this.Program.Negate = class Negate {
  constructor(token1, expression1) {
    this.token = token1;
    this.expression = expression1;
  }

};

this.Program.Not = class Not {
  constructor(token1, expression1) {
    this.token = token1;
    this.expression = expression1;
  }

};

this.Program.Braced = class Braced {
  constructor(token1, expression1) {
    this.token = token1;
    this.expression = expression1;
  }

};

this.Program.Return = class Return {
  constructor(token1, expression1) {
    this.token = token1;
    this.expression = expression1;
  }

};

this.Program.Condition = class Condition {
  constructor(token1, chain) {
    this.token = token1;
    this.chain = chain;
  }

};

this.Program.For = class For {
  constructor(token1, iterator, range_from, range_to, range_by, sequence) {
    this.token = token1;
    this.iterator = iterator;
    this.range_from = range_from;
    this.range_to = range_to;
    this.range_by = range_by;
    this.sequence = sequence;
  }

};

this.Program.ForIn = class ForIn {
  constructor(token1, iterator, list, sequence) {
    this.token = token1;
    this.iterator = iterator;
    this.list = list;
    this.sequence = sequence;
  }

};

this.Program.toString = function(value, nesting = 0) {
  var i, j, k, key, len, pref, ref, s, v;
  if (value instanceof Routine) {
    if (nesting === 0) {
      return value.source || "[function]";
    } else {
      return "[function]";
    }
  } else if (typeof value === "function") {
    return "[native function]";
  } else if (typeof value === "string") {
    return `"${value}"`;
  } else if (Array.isArray(value)) {
    if (nesting >= 1) {
      return "[list]";
    }
    s = "[";
    for (i = j = 0, len = value.length; j < len; i = ++j) {
      v = value[i];
      s += Program.toString(v, nesting + 1) + (i < value.length - 1 ? "," : "");
    }
    return s + "]";
  } else if (typeof value === "object") {
    if (nesting >= 1) {
      return "[object]";
    }
    s = "object\n";
    pref = "";
    for (i = k = 1, ref = nesting; k <= ref; i = k += 1) {
      pref += "  ";
    }
    for (key in value) {
      v = value[key];
      s += pref + `  ${key} = ${Program.toString(v, nesting + 1)}\n`;
    }
    return s + pref + "end";
  }
  return value || 0;
};

this.Program.While = class While {
  constructor(token1, condition, sequence) {
    this.token = token1;
    this.condition = condition;
    this.sequence = sequence;
  }

};

this.Program.Break = class Break {
  constructor(token1) {
    this.token = token1;
    this.nopop = true;
  }

};

this.Program.Continue = class Continue {
  constructor(token1) {
    this.token = token1;
    this.nopop = true;
  }

};

this.Program.Function = class Function {
  constructor(token1, args, sequence, end) {
    this.token = token1;
    this.args = args;
    this.sequence = sequence;
    this.source = "function" + this.token.tokenizer.input.substring(this.token.index, end.index + 2);
  }

};

this.Program.FunctionCall = class FunctionCall {
  constructor(token1, expression1, args) {
    this.token = token1;
    this.expression = expression1;
    this.args = args;
  }

};

this.Program.CreateObject = class CreateObject {
  constructor(token1, fields) {
    this.token = token1;
    this.fields = fields;
  }

};

this.Program.CreateClass = class CreateClass {
  constructor(token1, ext, fields) {
    this.token = token1;
    this.ext = ext;
    this.fields = fields;
  }

};

this.Program.NewCall = class NewCall {
  constructor(token1, expression1) {
    this.token = token1;
    this.expression = expression1;
    if (!(this.expression instanceof Program.FunctionCall)) {
      this.expression = new Program.FunctionCall(this.token, this.expression, []);
    }
  }

};

this.Program.After = class After {
  constructor(token1, delay, sequence, end, multiplier) {
    this.token = token1;
    this.delay = delay;
    this.sequence = sequence;
    this.multiplier = multiplier;
    this.source = "after " + this.token.tokenizer.input.substring(this.token.index, end.index + 2);
  }

};

this.Program.Every = class Every {
  constructor(token1, delay, sequence, end, multiplier) {
    this.token = token1;
    this.delay = delay;
    this.sequence = sequence;
    this.multiplier = multiplier;
    this.source = "every " + this.token.tokenizer.input.substring(this.token.index, end.index + 2);
  }

};

this.Program.Do = class Do {
  constructor(token1, sequence, end) {
    this.token = token1;
    this.sequence = sequence;
    this.source = "do " + this.token.tokenizer.input.substring(this.token.index, end.index + 2);
  }

};

this.Program.Sleep = class Sleep {
  constructor(token1, delay, multiplier) {
    this.token = token1;
    this.delay = delay;
    this.multiplier = multiplier;
  }

};

this.Program.Delete = class Delete {
  constructor(token1, field1) {
    this.token = token1;
    this.field = field1;
  }

};

this.Program.Precedence = {
  "^": 21,
  "/": 20,
  "*": 19,
  "%": 18,
  "+": 17,
  "-": 17,
  "<": 16,
  "<=": 15,
  ">": 14,
  ">=": 13,
  "==": 12,
  "!=": 11,
  "<<": 10,
  ">>": 9,
  "&": 8,
  "|": 7,
  "and": 6,
  "or": 5
};


this.Routine = class Routine {
  constructor(num_args) {
    this.num_args = num_args;
    this.ops = [];
    this.opcodes = [];
    this.arg1 = [];
    this.ref = [];
    this.label_count = 0;
    this.labels = {};
    this.transpile = false;
    this.import_refs = [];
    this.import_values = [];
    this.import_self = -1;
  }

  clone() {
    var r;
    r = new Routine(this.num_args);
    r.opcodes = this.opcodes;
    r.arg1 = this.arg1;
    r.ref = this.ref;
    r.locals_size = this.locals_size;
    r.uses_arguments = this.uses_arguments;
    return r;
  }

  createLabel(str = "label") {
    var name;
    return name = ":" + str + "_" + this.label_count++;
  }

  setLabel(name) {
    return this.labels[name] = this.opcodes.length;
  }

  optimize() {
    if (this.transpile) {
      new Transpiler().transpile(this);
    }
  }

  removeable(index) {
    var label, ref1, value;
    ref1 = this.labels;
    for (label in ref1) {
      value = ref1[label];
      if (value === index) {
        return false;
      }
    }
    return true;
  }

  remove(index) {
    var label, ref1, value;
    ref1 = this.labels;
    for (label in ref1) {
      value = ref1[label];
      if (value === index) {
        return false;
      } else if (value > index) {
        this.labels[label] -= 1;
      }
    }
    this.opcodes.splice(index, 1);
    this.arg1.splice(index, 1);
    this.ref.splice(index, 1);
    return true;
  }

  resolveLabels() {
    var i, j, ref1, ref2, ref3, results;
    results = [];
    for (i = j = 0, ref1 = this.opcodes.length - 1; (0 <= ref1 ? j <= ref1 : j >= ref1); i = 0 <= ref1 ? ++j : --j) {
      if ((ref2 = this.opcodes[i]) === OPCODES.JUMP || ref2 === OPCODES.JUMPY || ref2 === OPCODES.JUMPN || ref2 === OPCODES.JUMPY_NOPOP || ref2 === OPCODES.JUMPN_NOPOP) {
        if (this.labels[this.arg1[i]]) {
          results.push(this.arg1[i] = this.labels[this.arg1[i]]);
        } else {
          results.push(void 0);
        }
      } else if ((ref3 = this.opcodes[i]) === OPCODES.FORLOOP_CONTROL || ref3 === OPCODES.FORLOOP_INIT || ref3 === OPCODES.FORIN_CONTROL || ref3 === OPCODES.FORIN_INIT) {
        if (this.labels[this.arg1[i][1]]) {
          results.push(this.arg1[i][1] = this.labels[this.arg1[i][1]]);
        } else {
          results.push(void 0);
        }
      } else {
        results.push(void 0);
      }
    }
    return results;
  }

  OP(code, ref, v1 = 0) {
    this.opcodes.push(code);
    this.arg1.push(v1);
    return this.ref.push(ref);
  }

  OP_INSERT(code, ref, v1 = 0, index) {
    var label, ref1, value;
    this.opcodes.splice(index, 0, code);
    this.arg1.splice(index, 0, v1);
    this.ref.splice(index, 0, ref);
    ref1 = this.labels;
    for (label in ref1) {
      value = ref1[label];
      if (value >= index) {
        this.labels[label] += 1;
      }
    }
  }

  TYPE(ref) {
    return this.OP(OPCODES.TYPE, ref);
  }

  VARIABLE_TYPE(variable, ref) {
    return this.OP(OPCODES.VARIABLE_TYPE, ref, variable);
  }

  PROPERTY_TYPE(ref) {
    return this.OP(OPCODES.PROPERTY_TYPE, ref);
  }

  LOAD_THIS(ref) {
    return this.OP(OPCODES.LOAD_THIS, ref);
  }

  LOAD_GLOBAL(ref) {
    return this.OP(OPCODES.LOAD_GLOBAL, ref);
  }

  LOAD_VALUE(value, ref) {
    return this.OP(OPCODES.LOAD_VALUE, ref, value);
  }

  LOAD_LOCAL(index, ref) {
    return this.OP(OPCODES.LOAD_LOCAL, ref, index);
  }

  LOAD_VARIABLE(variable, ref) {
    return this.OP(OPCODES.LOAD_VARIABLE, ref, variable);
  }

  LOAD_LOCAL_OBJECT(index, ref) {
    return this.OP(OPCODES.LOAD_LOCAL_OBJECT, ref, index);
  }

  LOAD_VARIABLE_OBJECT(variable, ref) {
    return this.OP(OPCODES.LOAD_VARIABLE_OBJECT, ref, variable);
  }

  POP(ref) {
    return this.OP(OPCODES.POP, ref);
  }

  LOAD_PROPERTY(ref) {
    return this.OP(OPCODES.LOAD_PROPERTY, ref);
  }

  LOAD_PROPERTY_OBJECT(ref) {
    return this.OP(OPCODES.LOAD_PROPERTY_OBJECT, ref);
  }

  CREATE_OBJECT(ref) {
    return this.OP(OPCODES.CREATE_OBJECT, ref);
  }

  MAKE_OBJECT(ref) {
    return this.OP(OPCODES.MAKE_OBJECT, ref);
  }

  CREATE_ARRAY(ref) {
    return this.OP(OPCODES.CREATE_ARRAY, ref);
  }

  CREATE_CLASS(parent_var, ref) {
    return this.OP(OPCODES.CREATE_CLASS, ref, parent_var);
  }

  UPDATE_CLASS(variable, ref) {
    return this.OP(OPCODES.UPDATE_CLASS, ref, variable);
  }

  NEW_CALL(args, ref) {
    return this.OP(OPCODES.NEW_CALL, ref, args);
  }

  ADD(ref, self = 0) {
    return this.OP(OPCODES.ADD, ref, self);
  }

  SUB(ref, self = 0) {
    return this.OP(OPCODES.SUB, ref, self);
  }

  MUL(ref) {
    return this.OP(OPCODES.MUL, ref);
  }

  DIV(ref) {
    return this.OP(OPCODES.DIV, ref);
  }

  MODULO(ref) {
    return this.OP(OPCODES.MODULO, ref);
  }

  BINARY_AND(ref) {
    return this.OP(OPCODES.BINARY_AND, ref);
  }

  BINARY_OR(ref) {
    return this.OP(OPCODES.BINARY_OR, ref);
  }

  SHIFT_LEFT(ref) {
    return this.OP(OPCODES.SHIFT_LEFT, ref);
  }

  SHIFT_RIGHT(ref) {
    return this.OP(OPCODES.SHIFT_RIGHT, ref);
  }

  NEGATE(ref) {
    return this.OP(OPCODES.NEGATE, ref);
  }

  LOAD_PROPERTY_ATOP(ref) {
    return this.OP(OPCODES.LOAD_PROPERTY_ATOP, ref);
  }

  EQ(ref) {
    return this.OP(OPCODES.EQ, ref);
  }

  NEQ(ref) {
    return this.OP(OPCODES.NEQ, ref);
  }

  LT(ref) {
    return this.OP(OPCODES.LT, ref);
  }

  GT(ref) {
    return this.OP(OPCODES.GT, ref);
  }

  LTE(ref) {
    return this.OP(OPCODES.LTE, ref);
  }

  GTE(ref) {
    return this.OP(OPCODES.GTE, ref);
  }

  NOT(ref) {
    return this.OP(OPCODES.NOT, ref);
  }

  FORLOOP_INIT(iterator, ref) {
    return this.OP(OPCODES.FORLOOP_INIT, ref, iterator);
  }

  FORLOOP_CONTROL(args, ref) {
    return this.OP(OPCODES.FORLOOP_CONTROL, ref, args);
  }

  FORIN_INIT(args, ref) {
    return this.OP(OPCODES.FORIN_INIT, ref, args);
  }

  FORIN_CONTROL(args, ref) {
    return this.OP(OPCODES.FORIN_CONTROL, ref, args);
  }

  JUMP(index, ref) {
    return this.OP(OPCODES.JUMP, ref, index);
  }

  JUMPY(index, ref) {
    return this.OP(OPCODES.JUMPY, ref, index);
  }

  JUMPN(index, ref) {
    return this.OP(OPCODES.JUMPN, ref, index);
  }

  JUMPY_NOPOP(index, ref) {
    return this.OP(OPCODES.JUMPY_NOPOP, ref, index);
  }

  JUMPN_NOPOP(index, ref) {
    return this.OP(OPCODES.JUMPN_NOPOP, ref, index);
  }

  STORE_LOCAL(index, ref) {
    return this.OP(OPCODES.STORE_LOCAL, ref, index);
  }

  STORE_VARIABLE(field, ref) {
    return this.OP(OPCODES.STORE_VARIABLE, ref, field);
  }

  CREATE_PROPERTY(ref) {
    return this.OP(OPCODES.CREATE_PROPERTY, ref);
  }

  STORE_PROPERTY(ref) {
    return this.OP(OPCODES.STORE_PROPERTY, ref);
  }

  LOAD_ROUTINE(value, ref) {
    return this.OP(OPCODES.LOAD_ROUTINE, ref, value);
  }

  FUNCTION_CALL(args, ref) {
    return this.OP(OPCODES.FUNCTION_CALL, ref, args);
  }

  FUNCTION_APPLY_VARIABLE(args, ref) {
    return this.OP(OPCODES.FUNCTION_APPLY_VARIABLE, ref, args);
  }

  FUNCTION_APPLY_PROPERTY(args, ref) {
    return this.OP(OPCODES.FUNCTION_APPLY_PROPERTY, ref, args);
  }

  SUPER_CALL(args, ref) {
    return this.OP(OPCODES.SUPER_CALL, ref, args);
  }

  RETURN(ref) {
    return this.OP(OPCODES.RETURN, ref);
  }

  AFTER(ref) {
    return this.OP(OPCODES.AFTER, ref);
  }

  EVERY(ref) {
    return this.OP(OPCODES.EVERY, ref);
  }

  DO(ref) {
    return this.OP(OPCODES.DO, ref);
  }

  SLEEP(ref) {
    return this.OP(OPCODES.SLEEP, ref);
  }

  DELETE(ref) {
    return this.OP(OPCODES.DELETE, ref);
  }

  UNARY_OP(f, ref) {
    return this.OP(OPCODES.UNARY_OP, ref, f);
  }

  BINARY_OP(f, ref) {
    return this.OP(OPCODES.BINARY_OP, ref, f);
  }

  toString() {
    var i, j, len, op, ref1, s;
    s = "";
    ref1 = this.opcodes;
    for (i = j = 0, len = ref1.length; j < len; i = ++j) {
      op = ref1[i];
      s += OPCODES[op];
      if (this.arg1[i] != null) {
        //if typeof @arg1[i] != "function"
        s += ` ${this.arg1[i]}`;
      }
      s += "\n";
    }
    return s;
  }

  exportArg(arg) {
    if (arg == null) {
      return 0;
    } else if (arg instanceof Routine) {
      return arg.export();
    } else if (typeof arg === "function") {
      return arg.name;
    } else {
      return arg;
    }
  }

  export() {
    var args, i, j, ref1, res;
    args = [];
    for (i = j = 0, ref1 = this.arg1.length - 1; j <= ref1; i = j += 1) {
      args[i] = this.exportArg(this.arg1[i]);
    }
    res = {
      num_args: this.num_args,
      ops: this.opcodes,
      args: args,
      import_refs: this.import_refs,
      import_values: this.import_values,
      import_self: this.import_self,
      locals_size: this.locals_size
    };
    return res;
  }

  import(src) {
    var i, j, ref, ref1, token;
    this.num_args = src.num_args;
    this.opcodes = src.ops;
    this.arg1 = src.args;
    this.import_refs = src.import_refs;
    this.import_values = src.import_values;
    this.import_self = src.import_self;
    this.locals_size = src.locals_size;
    token = {
      line: 0,
      column: 0,
      start: 0,
      length: 0,
      index: 0,
      tokenizer: {
        filename: "filename",
        input: ""
      }
    };
    ref = {
      expression: {
        token: token
      },
      token: token
    };
    for (i = j = 0, ref1 = this.opcodes.length - 1; j <= ref1; i = j += 1) {
      if (this.opcodes[i] === 100) {
        this.arg1[i] = Compiler.predefined_unary_functions[this.arg1[i]];
      } else if (this.opcodes[i] === 101) {
        this.arg1[i] = Compiler.predefined_binary_functions[this.arg1[i]];
      } else if (typeof this.arg1[i] === "object" && !Array.isArray(this.arg1[i])) {
        this.arg1[i] = new Routine(0).import(this.arg1[i]);
      }
      this.ref[i] = ref;
    }
    return this;
  }

};

this.OPCODES_CLASS = class OPCODES_CLASS {
  constructor() {
    this.table = {};
    this.set("TYPE", 1);
    this.set("VARIABLE_TYPE", 2);
    this.set("PROPERTY_TYPE", 3);
    this.set("LOAD_IMPORT", 4);
    this.set("LOAD_THIS", 5);
    this.set("LOAD_GLOBAL", 6);
    this.set("LOAD_VALUE", 10);
    this.set("LOAD_LOCAL", 11);
    this.set("LOAD_VARIABLE", 12);
    this.set("LOAD_LOCAL_OBJECT", 13);
    this.set("LOAD_VARIABLE_OBJECT", 14);
    this.set("POP", 15);
    this.set("LOAD_PROPERTY", 16);
    this.set("LOAD_PROPERTY_OBJECT", 17);
    this.set("CREATE_OBJECT", 18);
    this.set("MAKE_OBJECT", 19);
    this.set("CREATE_ARRAY", 20);
    this.set("STORE_LOCAL", 21);
    this.set("STORE_VARIABLE", 23);
    this.set("CREATE_PROPERTY", 24);
    this.set("STORE_PROPERTY", 25);
    this.set("DELETE", 26);
    this.set("UPDATE_CLASS", 27);
    this.set("CREATE_CLASS", 28);
    this.set("NEW_CALL", 29);
    this.set("ADD", 30);
    this.set("SUB", 31);
    this.set("MUL", 32);
    this.set("DIV", 33);
    this.set("MODULO", 34);
    this.set("BINARY_AND", 35);
    this.set("BINARY_OR", 36);
    this.set("SHIFT_LEFT", 37);
    this.set("SHIFT_RIGHT", 38);
    this.set("NEGATE", 39);
    this.set("EQ", 40);
    this.set("NEQ", 41);
    this.set("LT", 42);
    this.set("GT", 43);
    this.set("LTE", 44);
    this.set("GTE", 45);
    this.set("NOT", 50);
    this.set("LOAD_PROPERTY_ATOP", 68);
    this.set("JUMP", 80);
    this.set("JUMPY", 81);
    this.set("JUMPN", 82);
    this.set("JUMPY_NOPOP", 83);
    this.set("JUMPN_NOPOP", 84);
    this.set("LOAD_ROUTINE", 89);
    this.set("FUNCTION_CALL", 90);
    this.set("FUNCTION_APPLY_VARIABLE", 91);
    this.set("FUNCTION_APPLY_PROPERTY", 92);
    this.set("SUPER_CALL", 93);
    this.set("RETURN", 94);
    this.set("FORLOOP_INIT", 95);
    this.set("FORLOOP_CONTROL", 96);
    this.set("FORIN_INIT", 97);
    this.set("FORIN_CONTROL", 98);
    this.set("UNARY_OP", 100);
    this.set("BINARY_OP", 101);
    this.set("COMPILED", 200);
    this.set("AFTER", 110);
    this.set("EVERY", 111);
    this.set("DO", 112);
    this.set("SLEEP", 113);
  }

  set(op, code) {
    this[op] = code;
    return this[code] = op;
  }

};

this.OPCODES = new this.OPCODES_CLASS;


this.Runner = class Runner {
  constructor(microvm) {
    this.microvm = microvm;
  }

  init() {
    this.initialized = true;
    this.system = this.microvm.context.global.system;
    this.system.preemptive = 1;
    this.system.threads = [];
    this.main_thread = new Thread(this);
    this.threads = [this.main_thread];
    this.current_thread = this.main_thread;
    this.thread_index = 0;
    this.microvm.context.global.print = this.microvm.context.meta.print;
    this.microvm.context.global.random = new Random(0);
    this.microvm.context.global.Function = {
      bind: function(obj) {
        var rc;
        if (this instanceof Routine) {
          rc = this.clone();
          rc.object = obj;
          return rc;
        } else {
          return this;
        }
      }
    };
    this.microvm.context.global.List = {
      sortList: (f) => {
        var funk;
        if ((f != null) && f instanceof Program.Function) {
          funk = function(a, b) {
            return f.call(this.microvm.context.global, [a, b], true);
          };
        } else if ((f != null) && typeof f === "function") {
          funk = f;
        }
        return this.sort(funk);
      },
      "+": function(a, b, self) {
        if (!self) { // not +=, clone array a
          a = [...a];
        }
        if (Array.isArray(b)) {
          return a.concat(b);
        } else {
          a.push(b);
          return a;
        }
      },
      "-": function(a, b, self) {
        var index;
        if (!self) { // not -=, clone array a
          a = [...a];
        }
        index = a.indexOf(b);
        if (index >= 0) {
          a.splice(index, 1);
        }
        return a;
      }
    };
    this.microvm.context.global.Object = {};
    this.microvm.context.global.String = {
      fromCharCode: function(...args) { return String.fromCharCode(...args) },
      "+": function(a, b) {
        return a + b;
      }
    };
    this.microvm.context.global.Number = {
      parse: function(s) {
        var res;
        res = Number.parseFloat(s);
        if (isFinite(res)) {
          return res;
        } else {
          return 0;
        }
      },
      toString: function() {
        return this.toString();
      }
    };
    this.fps = 60;
    this.fps_max = 60;
    this.cpu_load = 0;
    this.microvm.context.meta.print("microScript 2.0");
    return this.triggers_controls_update = true;
  }

  run(src, filename, callback) {
    var compiler, err, id, j, len, parser, program, ref, result, w;
    if (!this.initialized) {
      this.init();
    }
    parser = new Parser(src, filename);
    parser.parse();
    if (parser.error_info != null) {
      err = parser.error_info;
      err.type = "compile";
      throw err;
    }
    if (parser.warnings.length > 0) {
      ref = parser.warnings;
      for (j = 0, len = ref.length; j < len; j++) {
        w = ref[j];
        id = filename + "-" + w.line + "-" + w.column;
        switch (w.type) {
          case "assigning_api_variable":
            if (this.microvm.context.warnings.assigning_api_variable[id] == null) {
              this.microvm.context.warnings.assigning_api_variable[id] = {
                file: filename,
                line: w.line,
                column: w.column,
                expression: w.identifier
              };
            }
            break;
          case "assignment_as_condition":
            if (this.microvm.context.warnings.assignment_as_condition[id] == null) {
              this.microvm.context.warnings.assignment_as_condition[id] = {
                file: filename,
                line: w.line,
                column: w.column
              };
            }
        }
      }
    }
    program = parser.program;
    compiler = new Compiler(program);
    result = null;
    compiler.routine.callback = function(res) {
      if (callback != null) {
        return callback(Program.toString(res));
      } else {
        return result = res;
      }
    };
    this.main_thread.addCall(compiler.routine);
    this.tick();
    return result;
  }

  call(name, args) {
    var f, routine;
    if (name === "draw" || name === "update" || name === "serverUpdate") {
      if (this.microvm.context.global[name] != null) {
        this.main_thread.addCall(`${name}()`);
      }
      return;
    }
    if (this.microvm.context.global[name] != null) {
      if ((args == null) || !args.length) {
        return this.main_thread.addCall(`${name}()`);
      } else {
        routine = this.microvm.context.global[name];
        if (routine instanceof Routine) {
          f = this.main_thread.processor.routineAsFunction(routine, this.microvm.context);
          return f(...args);
        } else if (typeof routine === "function") {
          return routine(...args);
        }
      }
    } else {
      return 0;
    }
  }

  toString(obj) {
    return Program.toString(obj);
  }

  process(thread, time_limit) {
    var processor;
    processor = thread.processor;
    processor.time_limit = time_limit;
    this.current_thread = thread;
    return processor.run(this.microvm.context);
  }

  tick() {
    var dt, frame_time, i, index, j, k, len, load, margin, processing, processor, ref, ref1, t, time, time_limit, time_out;
    if (this.system.fps != null) {
      this.fps = this.fps * .9 + this.system.fps * .1;
    }
    this.fps_max = Math.max(this.fps, this.fps_max);
    frame_time = Math.min(16, Math.floor(1000 / this.fps_max));
    if (this.fps < 59) {
      margin = 10;
    } else {
      margin = Math.floor(1000 / this.fps * .8);
    }
    time = Date.now();
    time_limit = time + 100; // allow more time to prevent interrupting main_thread in the middle of a draw()
    time_out = this.system.preemptive ? time_limit : 2e308;
    processor = this.main_thread.processor;
    if (!processor.done) {
      if (this.main_thread.sleep_until != null) {
        if (Date.now() >= this.main_thread.sleep_until) {
          delete this.main_thread.sleep_until;
          this.process(this.main_thread, time_out);
        }
      } else {
        this.process(this.main_thread, time_out);
      }
    }
    while (processor.done && Date.now() < time_out && this.main_thread.loadNext()) {
      this.process(this.main_thread, time_out);
    }
    time_limit = time + margin; // secondary threads get remaining time
    time_out = this.system.preemptive ? time_limit : 2e308;
    processing = true;
    while (processing) {
      processing = false;
      ref = this.threads;
      for (j = 0, len = ref.length; j < len; j++) {
        t = ref[j];
        if (t !== this.main_thread) {
          if (t.paused || t.terminated) {
            continue;
          }
          processor = t.processor;
          if (!processor.done) {
            if (t.sleep_until != null) {
              if (Date.now() >= t.sleep_until) {
                delete t.sleep_until;
                this.process(t, time_out);
                processing = true;
              }
            } else {
              this.process(t, time_out);
              processing = true;
            }
          } else if (t.start_time != null) {
            if (t.repeat) {
              while (time >= t.start_time && !(t.paused || t.terminated)) {
                if (time >= t.start_time + 150) {
                  t.start_time = time + t.delay;
                } else {
                  t.start_time += t.delay;
                }
                processor.load(t.routine);
                this.process(t, time_out);
                processing = true;
              }
            } else {
              if (time >= t.start_time) {
                delete t.start_time;
                processor.load(t.routine);
                this.process(t, time_out);
                processing = true;
              }
            }
          } else {
            t.terminated = true;
          }
        }
      }
      if (Date.now() > time_limit) {
        break;
      }
    }
    for (i = k = ref1 = this.threads.length - 1; k >= 1; i = k += -1) {
      t = this.threads[i];
      if (t.terminated) {
        this.threads.splice(i, 1);
        index = this.system.threads.indexOf(t.interface);
        if (index >= 0) {
          this.system.threads.splice(index, 1);
        }
      }
    }
    t = Date.now() - time;
    dt = time_limit - time;
    load = t / dt * 100;
    this.cpu_load = this.cpu_load * .9 + load * .1;
    this.system.cpu_load = Math.min(100, Math.round(this.cpu_load));
  }

  createThread(routine, delay, repeat) {
    var i, j, ref, t;
    t = new Thread(this);
    t.routine = routine;
    this.threads.push(t);
    t.start_time = Date.now() + delay - 1000 / this.fps;
    if (repeat) {
      t.repeat = repeat;
      t.delay = delay;
    }
    this.system.threads.push(t.interface);
    for (i = j = 0, ref = routine.import_values.length - 1; j <= ref; i = j += 1) {
      if (routine.import_values[i] === routine) {
        routine.import_values[i] = t.interface;
      }
    }
    return t.interface;
  }

  sleep(value) {
    if (this.current_thread != null) {
      return this.current_thread.sleep_until = Date.now() + Math.max(0, value);
    }
  }

};

this.Thread = class Thread {
  constructor(runner) {
    this.runner = runner;
    this.loop = false;
    this.processor = new Processor(this.runner);
    this.paused = false;
    this.terminated = false;
    this.next_calls = [];
    this.interface = {
      pause: () => {
        return this.pause();
      },
      resume: () => {
        return this.resume();
      },
      stop: () => {
        return this.stop();
      },
      status: "running"
    };
  }

  addCall(call) {
    if (this.next_calls.indexOf(call) < 0) {
      return this.next_calls.push(call);
    }
  }

  loadNext() {
    var compiler, f, parser, program;
    if (this.next_calls.length > 0) {
      f = this.next_calls.splice(0, 1)[0];
      if (f instanceof Routine) {
        this.processor.load(f);
      } else {
        parser = new Parser(f, "");
        parser.parse();
        program = parser.program;
        compiler = new Compiler(program);
        this.processor.load(compiler.routine);
        if ((f === "update()" || f === "serverUpdate()") && (this.runner.updateControls != null)) {
          this.runner.updateControls();
        }
      }
      return true;
    } else {
      return false;
    }
  }

  pause() {
    if (this.interface.status === "running") {
      this.interface.status = "paused";
      this.paused = true;
      return 1;
    } else {
      return 0;
    }
  }

  resume() {
    if (this.interface.status === "paused") {
      this.interface.status = "running";
      this.paused = false;
      return 1;
    } else {
      return 0;
    }
  }

  stop() {
    this.interface.status = "stopped";
    this.terminated = true;
    return 1;
  }

};


this.Token = class Token {
  constructor(tokenizer, type, value, string_value) {
    this.tokenizer = tokenizer;
    this.type = type;
    this.value = value;
    this.string_value = string_value;
    this.line = this.tokenizer.line;
    this.column = this.tokenizer.column;
    this.start = this.tokenizer.token_start;
    this.length = this.tokenizer.index - this.start;
    this.index = this.tokenizer.index;
    if (this.type === Token.TYPE_IDENTIFIER && Token.predefined.hasOwnProperty(this.value)) {
      this.type = Token.predefined[this.value];
      this.reserved_keyword = true;
    }
    this.is_binary_operator = (this.type >= 30 && this.type <= 39) || (this.type >= 200 && this.type <= 201) || (this.type >= 2 && this.type <= 7);
  }

  toString() {
    return this.value + " : " + this.type;
  }

};

this.Token.TYPE_EQUALS = 1;

this.Token.TYPE_DOUBLE_EQUALS = 2;

this.Token.TYPE_GREATER = 3;

this.Token.TYPE_GREATER_OR_EQUALS = 4;

this.Token.TYPE_LOWER = 5;

this.Token.TYPE_LOWER_OR_EQUALS = 6;

this.Token.TYPE_UNEQUALS = 7;

this.Token.TYPE_IDENTIFIER = 10;

this.Token.TYPE_NUMBER = 11;

this.Token.TYPE_STRING = 12;

this.Token.TYPE_OPEN_BRACE = 20;

this.Token.TYPE_CLOSED_BRACE = 21;

// @Token.TYPE_OPEN_CURLY_BRACE = 22
// @Token.TYPE_CLOSED_CURLY_BRACE = 23
this.Token.TYPE_OPEN_BRACKET = 24;

this.Token.TYPE_CLOSED_BRACKET = 25;

this.Token.TYPE_COMMA = 26;

this.Token.TYPE_DOT = 27;

this.Token.TYPE_PLUS = 30;

this.Token.TYPE_MINUS = 31;

this.Token.TYPE_MULTIPLY = 32;

this.Token.TYPE_DIVIDE = 33;

this.Token.TYPE_POWER = 34;

this.Token.TYPE_MODULO = 35;

this.Token.TYPE_BINARY_AND = 36;

this.Token.TYPE_BINARY_OR = 37;

this.Token.TYPE_SHIFT_LEFT = 38;

this.Token.TYPE_SHIFT_RIGHT = 39;

this.Token.TYPE_PLUS_EQUALS = 40;

this.Token.TYPE_MINUS_EQUALS = 41;

this.Token.TYPE_MULTIPLY_EQUALS = 42;

this.Token.TYPE_DIVIDE_EQUALS = 43;

this.Token.TYPE_MODULO_EQUALS = 44;

this.Token.TYPE_AND_EQUALS = 45;

this.Token.TYPE_OR_EQUALS = 46;

this.Token.TYPE_RETURN = 50;

this.Token.TYPE_BREAK = 51;

this.Token.TYPE_CONTINUE = 52;

this.Token.TYPE_FUNCTION = 60;

this.Token.TYPE_AFTER = 61;

this.Token.TYPE_EVERY = 62;

this.Token.TYPE_DO = 63;

this.Token.TYPE_SLEEP = 64;

this.Token.TYPE_LOCAL = 70;

this.Token.TYPE_OBJECT = 80;

this.Token.TYPE_CLASS = 90;

this.Token.TYPE_EXTENDS = 91;

this.Token.TYPE_NEW = 92;

this.Token.TYPE_FOR = 100;

this.Token.TYPE_TO = 101;

this.Token.TYPE_BY = 102;

this.Token.TYPE_IN = 103;

this.Token.TYPE_WHILE = 104;

this.Token.TYPE_IF = 105;

this.Token.TYPE_THEN = 106;

this.Token.TYPE_ELSE = 107;

this.Token.TYPE_ELSIF = 108;

this.Token.TYPE_END = 120;

this.Token.TYPE_AND = 200;

this.Token.TYPE_OR = 201;

this.Token.TYPE_NOT = 202;

this.Token.TYPE_ERROR = 404;

this.Token.predefined = {};

this.Token.predefined["return"] = this.Token.TYPE_RETURN;

this.Token.predefined["break"] = this.Token.TYPE_BREAK;

this.Token.predefined["continue"] = this.Token.TYPE_CONTINUE;

this.Token.predefined["function"] = this.Token.TYPE_FUNCTION;

this.Token.predefined["for"] = this.Token.TYPE_FOR;

this.Token.predefined["to"] = this.Token.TYPE_TO;

this.Token.predefined["by"] = this.Token.TYPE_BY;

this.Token.predefined["in"] = this.Token.TYPE_IN;

this.Token.predefined["while"] = this.Token.TYPE_WHILE;

this.Token.predefined["if"] = this.Token.TYPE_IF;

this.Token.predefined["then"] = this.Token.TYPE_THEN;

this.Token.predefined["else"] = this.Token.TYPE_ELSE;

this.Token.predefined["elsif"] = this.Token.TYPE_ELSIF;

this.Token.predefined["end"] = this.Token.TYPE_END;

this.Token.predefined["object"] = this.Token.TYPE_OBJECT;

this.Token.predefined["class"] = this.Token.TYPE_CLASS;

this.Token.predefined["extends"] = this.Token.TYPE_EXTENDS;

this.Token.predefined["new"] = this.Token.TYPE_NEW;

this.Token.predefined["and"] = this.Token.TYPE_AND;

this.Token.predefined["or"] = this.Token.TYPE_OR;

this.Token.predefined["not"] = this.Token.TYPE_NOT;

this.Token.predefined["after"] = this.Token.TYPE_AFTER;

this.Token.predefined["every"] = this.Token.TYPE_EVERY;

this.Token.predefined["do"] = this.Token.TYPE_DO;

this.Token.predefined["sleep"] = this.Token.TYPE_SLEEP;

this.Token.predefined["delete"] = this.Token.TYPE_DELETE;

this.Token.predefined["local"] = this.Token.TYPE_LOCAL;


this.Tokenizer = class Tokenizer {
  constructor(input, filename) {
    this.input = input;
    this.filename = filename;
    this.index = 0;
    this.line = 1;
    this.column = 0;
    this.last_column = 0;
    this.buffer = [];
    this.chars = {};
    this.chars["("] = Token.TYPE_OPEN_BRACE;
    this.chars[")"] = Token.TYPE_CLOSED_BRACE;
    this.chars["["] = Token.TYPE_OPEN_BRACKET;
    this.chars["]"] = Token.TYPE_CLOSED_BRACKET;
    this.chars["{"] = Token.TYPE_OPEN_CURLY_BRACE;
    this.chars["}"] = Token.TYPE_CLOSED_CURLY_BRACE;
    this.chars["^"] = Token.TYPE_POWER;
    this.chars[","] = Token.TYPE_COMMA;
    this.chars["."] = Token.TYPE_DOT;
    this.doubles = {};
    this.doubles[">"] = [Token.TYPE_GREATER, Token.TYPE_GREATER_OR_EQUALS];
    this.doubles["<"] = [Token.TYPE_LOWER, Token.TYPE_LOWER_OR_EQUALS];
    this.doubles["="] = [Token.TYPE_EQUALS, Token.TYPE_DOUBLE_EQUALS];
    this.doubles["+"] = [Token.TYPE_PLUS, Token.TYPE_PLUS_EQUALS];
    this.doubles["-"] = [Token.TYPE_MINUS, Token.TYPE_MINUS_EQUALS];
    this.doubles["*"] = [Token.TYPE_MULTIPLY, Token.TYPE_MULTIPLY_EQUALS];
    this.doubles["/"] = [Token.TYPE_DIVIDE, Token.TYPE_DIVIDE_EQUALS];
    this.doubles["%"] = [Token.TYPE_MODULO, Token.TYPE_MODULO_EQUALS];
    this.doubles["&"] = [Token.TYPE_BINARY_AND, Token.TYPE_AND_EQUALS];
    this.doubles["|"] = [Token.TYPE_BINARY_OR, Token.TYPE_OR_EQUALS];
    this.shifts = {
      "<": Token.TYPE_SHIFT_LEFT,
      ">": Token.TYPE_SHIFT_RIGHT
    };
    this.letter_regex = RegExp(/^\p{L}/, 'u');
  }

  pushBack(token) {
    return this.buffer.splice(0, 0, token);
  }

  finished() {
    return this.index >= this.input.length && this.buffer.length === 0;
  }

  nextChar(ignore_comments = false) {
    var c, endseq;
    c = this.input.charAt(this.index++);
    if (c === "\n") {
      this.line += 1;
      this.last_column = this.column;
      this.column = 0;
    } else if (c === "/" && !ignore_comments) {
      if (this.input.charAt(this.index) === "/") {
        while (true) {
          c = this.input.charAt(this.index++);
          if (c === "\n" || this.index >= this.input.length) {
            break;
          }
        }
        this.line += 1;
        this.last_column = this.column;
        this.column = 0;
        return this.nextChar();
      } else if (this.input.charAt(this.index) === "*") {
        endseq = 0;
        while (true) {
          c = this.input.charAt(this.index++);
          if (c === "\n") {
            this.line += 1;
            this.last_column = this.column;
            this.column = 0;
            endseq = 0;
          } else if (c === "*") {
            endseq = 1;
          } else if (c === "/" && endseq === 1) {
            break;
          } else {
            endseq = 0;
          }
          if (this.index >= this.input.length) {
            break;
          }
        }
        return this.nextChar();
      }
    } else {
      this.column += 1;
    }
    return c;
  }

  rewind() {
    this.index -= 1;
    this.column -= 1;
    if (this.input.charAt(this.index) === "\n") {
      this.line -= 1;
      return this.column = this.last_column;
    }
  }

  next() {
    var c, code;
    if (this.buffer.length > 0) {
      return this.buffer.splice(0, 1)[0];
    }
    while (true) {
      if (this.index >= this.input.length) {
        return null;
      }
      c = this.nextChar();
      code = c.charCodeAt(0);
      if (code > 32 && code !== 160) {
        break;
      }
    }
    this.token_start = this.index - 1;
    if (this.doubles[c] != null) {
      return this.parseDouble(c, this.doubles[c]);
    }
    if (this.chars[c] != null) {
      return new Token(this, this.chars[c], c);
    }
    if (c === "!") {
      return this.parseUnequals(c);
    } else if (code >= 48 && code <= 57) {
      return this.parseNumber(c);
    } else if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 95 || this.letter_regex.test(c)) {
      return this.parseIdentifier(c);
    } else if (c === '"') {
      return this.parseString(c, '"');
    } else if (c === "'") {
      return this.parseString(c, "'");
    } else {
      return this.error("Syntax Error");
    }
  }

  changeNumberToIdentifier() {
    var i, j, ref, results, token, v;
    token = this.next();
    if ((token != null) && token.type === Token.TYPE_NUMBER) {
      v = token.string_value.split(".");
      results = [];
      for (i = j = ref = v.length - 1; j >= 0; i = j += -1) {
        if (v[i].length > 0) {
          this.pushBack(new Token(this, Token.TYPE_IDENTIFIER, v[i]));
        }
        if (i > 0) {
          results.push(this.pushBack(new Token(this, Token.TYPE_DOT, ".")));
        } else {
          results.push(void 0);
        }
      }
      return results;
    } else if ((token != null) && token.type === Token.TYPE_STRING) {
      return this.pushBack(new Token(this, Token.TYPE_IDENTIFIER, token.value));
    } else {
      return this.pushBack(token);
    }
  }

  parseDouble(c, d) {
    if ((this.shifts[c] != null) && this.index < this.input.length && this.input.charAt(this.index) === c) {
      this.nextChar();
      return new Token(this, this.shifts[c], c + c);
    } else if (this.index < this.input.length && this.input.charAt(this.index) === "=") {
      this.nextChar();
      return new Token(this, d[1], c + "=");
    } else {
      return new Token(this, d[0], c);
    }
  }

  parseEquals(c) {
    if (this.index < this.input.length && this.input.charAt(this.index) === "=") {
      this.nextChar();
      return new Token(this, Token.TYPE_DOUBLE_EQUALS, "==");
    } else {
      return new Token(this, Token.TYPE_EQUALS, "=");
    }
  }

  parseGreater(c) {
    if (this.index < this.input.length && this.input.charAt(this.index) === "=") {
      this.nextChar();
      return new Token(this, Token.TYPE_GREATER_OR_EQUALS, ">=");
    } else {
      return new Token(this, Token.TYPE_GREATER_OR_EQUALS, ">");
    }
  }

  parseLower(c) {
    if (this.index < this.input.length && this.input.charAt(this.index) === "=") {
      this.nextChar();
      return new Token(this, Token.TYPE_LOWER_OR_EQUALS, "<=");
    } else {
      return new Token(this, Token.TYPE_LOWER, "<");
    }
  }

  parseUnequals(c) {
    if (this.index < this.input.length && this.input.charAt(this.index) === "=") {
      this.nextChar();
      return new Token(this, Token.TYPE_UNEQUALS, "!=");
    } else {
      return this.error("Expected inequality !=");
    }
  }

  parseIdentifier(s) {
    var c, code;
    while (true) {
      if (this.index >= this.input.length) {
        return new Token(this, Token.TYPE_IDENTIFIER, s);
      }
      c = this.nextChar();
      code = c.charCodeAt(0);
      if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 95 || (code >= 48 && code <= 57) || this.letter_regex.test(c)) {
        s += c;
      } else {
        this.rewind();
        return new Token(this, Token.TYPE_IDENTIFIER, s);
      }
    }
  }

  parseNumber(s) {
    var c, code, exp, pointed;
    pointed = false;
    exp = false;
    while (true) {
      if (this.index >= this.input.length) {
        return new Token(this, Token.TYPE_NUMBER, Number.parseFloat(s), s);
      }
      c = this.nextChar();
      code = c.charCodeAt(0);
      if (c === "." && !pointed && !exp) {
        pointed = true;
        s += c;
      } else if (code >= 48 && code <= 57) {
        s += c;
      } else if ((c === "e" || c === "E") && !exp && this.index < this.input.length) {
        exp = true;
        s += c;
        c = this.nextChar();
        if (c === "+" || c === "-") {
          s += c;
        } else {
          this.rewind();
        }
      } else if ((c === "x" || c === "X") && s === "0") {
        return this.parseHexNumber("0x");
      } else {
        this.rewind();
        return new Token(this, Token.TYPE_NUMBER, Number.parseFloat(s), s);
      }
    }
  }

  parseHexNumber(s) {
    var c;
    while (true) {
      if (this.index >= this.input.length) {
        return new Token(this, Token.TYPE_NUMBER, Number.parseInt(s), s);
      }
      c = this.nextChar();
      if (/[a-fA-F0-9]/.test(c)) {
        s += c;
      } else {
        this.rewind();
        return new Token(this, Token.TYPE_NUMBER, Number.parseInt(s), s);
      }
    }
  }

  parseString(s, close = '"') {
    var c, code, count_close, n;
    if (close === '"') {
      if (this.input.charAt(this.index) === '"' && this.input.charAt(this.index + 1) === '"' && this.input.charAt(this.index + 2) !== '"') {
        close = '"""';
        this.nextChar(true);
        this.nextChar(true);
      }
    }
    count_close = 0;
    while (true) {
      if (this.index >= this.input.length) {
        return this.error("Unclosed string value");
      }
      c = this.nextChar(true);
      code = c.charCodeAt(0);
      if (c === "\\") {
        n = this.nextChar(true);
        switch (n) {
          case "n":
            s += "\n";
            break;
          case "\\":
            s += "\\";
            break;
          case close:
            s += close;
            break;
          default:
            s += "\\" + n;
        }
      } else if (c === close) {
        n = this.nextChar(true);
        if (n === close) {
          s += c;
        } else {
          this.rewind();
          s += c;
          return new Token(this, Token.TYPE_STRING, s.substring(1, s.length - 1));
        }
      } else {
        if (close === '"""' && c === '"') {
          count_close += 1;
          if (count_close === 3) {
            return new Token(this, Token.TYPE_STRING, s.substring(1, s.length - 2));
          }
        } else {
          count_close = 0;
        }
        s += c;
      }
    }
  }

  error(s) {
    throw s;
  }

};


var Transpiler;

Transpiler = (function() {
  function Transpiler() {}

  Transpiler.prototype.transpile = function(r) {
    var i, j, l, op, ref, results;
    results = [];
    for (i = l = 0, ref = r.opcodes.length - 1; l <= ref; i = l += 1) {
      op = OPCODES[r.opcodes[i]];
      if (this.transpilable(op, r.arg1[i])) {
        j = i + 1;
        while (j < r.opcodes.length && r.removeable(j) && this.transpilable(OPCODES[r.opcodes[j]], r.arg1[j])) {
          j += 1;
        }
        j -= 1;
        if (j - i >= 2) {
          results.push(this.transpileSegment(r, i, j));
        } else {
          results.push(void 0);
        }
      } else {
        results.push(void 0);
      }
    }
    return results;
  };

  Transpiler.prototype.transpileSegment = function(r, i, j) {
    var comp, err, index, k, l, m, ref, ref1, ref2, ref3, s;
    this.vcount = 0;
    this.stack = new Stack();
    this.locals = {};
    this.variables = {};
    s = "f = function(stack,stack_index,locals,locals_offset,object,global) {\n";
    for (k = l = ref = i, ref1 = j; l <= ref1; k = l += 1) {
      console.info(OPCODES[r.opcodes[k]] + " " + r.arg1[k]);
      comp = this[OPCODES[r.opcodes[k]]](r.arg1[k]);
      if (comp) {
        s += comp + "\n";
      }
    }
    for (index in this.stack.touched) {
      if (this.stack.touched[index]) {
        if (index < 0) {
          s += "stack[stack_index-" + (Math.abs(index)) + "] = " + this.stack.stack[index] + " ;\n";
        } else if (index > 0) {
          s += "stack[stack_index+" + index + "] = " + this.stack.stack[index] + " ;\n";
        } else {
          s += "stack[stack_index] = " + this.stack.stack[index] + " ;\n";
        }
      }
    }
    if (this.stack.index < 0) {
      s += "stack_index -= " + (Math.abs(this.stack.index)) + " ;\n";
    } else if (this.stack.index > 0) {
      s += "stack_index += " + this.stack.index + " ;\n";
    }
    s += "return stack_index ;\n}";
    console.info(s);
    try {
      eval(s);
    } catch (error) {
      err = error;
      console.error(s);
      console.error(err);
    }
    r.opcodes[i] = 200;
    r.arg1[i] = f;
    for (k = m = ref2 = i + 1, ref3 = j; m <= ref3; k = m += 1) {
      r.remove(i + 1);
    }
  };

  Transpiler.prototype.createVariable = function() {
    return "v" + (this.vcount++);
  };

  Transpiler.prototype.transpilable = function(op, arg) {
    var ref;
    if (op === "LOAD_VALUE") {
      return (ref = typeof arg) === "string" || ref === "number";
    } else {
      return this[op] != null;
    }
  };

  Transpiler.prototype.LOAD_VALUE = function(arg) {
    if (typeof arg === "string") {
      this.stack.push(" \"" + (arg.replace(/"/g, "\\\"")) + "\" ");
    } else if (typeof arg === "number") {
      this.stack.push(arg + "");
    }
    return "";
  };

  Transpiler.prototype.LOAD_LOCAL = function(arg) {
    var v;
    v = this.createVariable();
    this.stack.push(v);
    return "let " + v + " = locals[locals_offset+" + arg + "] ; // LOAD_LOCAL";
  };

  Transpiler.prototype.LOAD_LOCAL_OBJECT = function(arg) {
    var res, v;
    if (this.locals[arg] != null) {
      v = this.locals[arg];
      this.stack.push(v);
      return "if (typeof " + v + " != \"object\") { " + v + " = locals[locals_offset+" + arg + "] = {} } ;";
    } else {
      v = this.createVariable();
      res = "let " + v + " = locals[locals_offset+" + arg + "] ;\nif (typeof " + v + " != \"object\") { " + v + " = locals[locals_offset+" + arg + "] = {} } ;";
      this.stack.push(v);
      this.locals[arg] = v;
      return res;
    }
  };

  Transpiler.prototype.STORE_LOCAL = function(arg) {
    var v;
    v = this.stack.get();
    return "locals[locals_offset+" + arg + "] = " + v + " ; // STORE_LOCAL";
  };

  Transpiler.prototype.POP = function() {
    this.stack.pop();
    return "";
  };

  Transpiler.prototype.CREATE_PROPERTY = function(arg) {
    var res;
    res = (this.stack.get(-2)) + "[" + (this.stack.get(-1)) + "] = " + (this.stack.get()) + " ;";
    this.stack.pop();
    this.stack.pop();
    return res;
  };

  Transpiler.prototype.LOAD_PROPERTY = function(arg) {
    var res, v;
    v = this.createVariable();
    res = "let " + v + " = " + (this.stack.get(-1)) + "[" + (this.stack.get()) + "] ; // LOAD_PROPERTY\nif (" + v + " == null) { " + v + " = 0 ; }";
    this.stack.pop();
    this.stack.pop();
    this.stack.push(v);
    return res;
  };

  Transpiler.prototype.LOAD_PROPERTY_ATOP = function(arg) {
    var res, v;
    v = this.createVariable();
    res = "let " + v + " = " + (this.stack.get(-1)) + "[" + (this.stack.get()) + "] ; // LOAD_PROPERTY_ATOP\nif (" + v + " == null) { " + v + " = 0 ; }";
    this.stack.push(v);
    return res;
  };

  Transpiler.prototype.NEW_OBJECT = function() {
    var v;
    v = this.createVariable();
    this.stack.push(v);
    return "let " + v + " = {} ;";
  };

  Transpiler.prototype.NEW_ARRAY = function() {
    var v;
    v = this.createVariable();
    this.stack.push(v);
    return "let " + v + " = [] ;";
  };

  Transpiler.prototype.MAKE_OBJECT = function() {
    var res, v;
    v = this.createVariable();
    res = "let " + v + " = " + (this.stack.get()) + " ;\nif (typeof " + v + " != \"object\") " + v + " = {} ; ";
    this.stack.pop();
    this.stack.push(v);
    return res;
  };

  Transpiler.prototype.STORE_VARIABLE = function(arg) {
    if (this.variables[arg] != null) {
      return this.variables[arg] + " = object[\"" + arg + "\"] = " + (this.stack.get()) + " ; // STORE_VARIABLE";
    } else {
      return "object[\"" + arg + "\"] = " + (this.stack.get()) + " ; // STORE_VARIABLE";
    }
  };

  Transpiler.prototype.STORE_PROPERTY = function(arg) {
    var res, v;
    v = this.createVariable();
    res = "let " + v + " = " + (this.stack.get(-2)) + "[" + (this.stack.get(-1)) + "] = " + (this.stack.get(0)) + " ; // STORE_PROPERTY";
    this.stack.pop();
    this.stack.pop();
    this.stack.pop();
    this.stack.push(v);
    return res;
  };

  return Transpiler;

})();

this.Stack = (function() {
  function Stack() {
    this.stack = ["stack[stack_index]"];
    this.index = 0;
    this.touched = {};
  }

  Stack.prototype.push = function(value) {
    this.stack[++this.index] = value;
    return this.touched[this.index] = true;
  };

  Stack.prototype.pop = function() {
    var res;
    if (this.index >= 0) {
      res = this.stack.splice(this.index, 1)[0];
    } else if (this.stack[this.index] != null) {
      res = this.stack[this.index];
    } else {
      res = "stack[stack_index-" + this.index + "]";
    }
    this.index -= 1;
    return res;
  };

  Stack.prototype.get = function(index) {
    var i;
    if (index == null) {
      index = 0;
    }
    i = this.index + index;
    if (i >= 0) {
      return this.stack[i];
    } else if (this.stack[i] != null) {
      return this.stack[i];
    } else {
      return "stack[stack_index-" + (-i) + "]";
    }
  };

  return Stack;

})();


var Random;

Random = (function() {
  function Random(_seed, hash) {
    this._seed = _seed != null ? _seed : Math.random();
    if (hash == null) {
      hash = true;
    }
    if (this._seed === 0) {
      this._seed = Math.random();
    }
    if (this._seed < 1) {
      this._seed *= 1 << 30;
    }
    this.a = 13971;
    this.b = 12345;
    this.size = 1 << 30;
    this.mask = this.size - 1;
    this.norm = 1 / this.size;
    if (hash) {
      this.nextSeed();
      this.nextSeed();
      this.nextSeed();
    }
  }

  Random.prototype.next = function() {
    this._seed = (this._seed * this.a + this.b) & this.mask;
    return this._seed * this.norm;
  };

  Random.prototype.nextInt = function(num) {
    return Math.floor(this.next() * num);
  };

  Random.prototype.nextSeed = function() {
    return this._seed = (this._seed * this.a + this.b) & this.mask;
  };

  Random.prototype.seed = function(_seed) {
    this._seed = _seed != null ? _seed : Math.random();
    if (this._seed < 1) {
      this._seed *= 1 << 30;
    }
    this.nextSeed();
    this.nextSeed();
    return this.nextSeed();
  };

  Random.prototype.clone = function(seed) {
    if (seed != null) {
      return new Random(seed);
    } else {
      seed = this._seed;
      return new Random(seed, false);
    }
  };

  return Random;

})();

this.MicroVM = class MicroVM {
  constructor(meta = {}, global = {}, namespace1 = "/microstudio", preserve_ls = false) {
    var ctx, err;
    this.namespace = namespace1;
    this.preserve_ls = preserve_ls;
    if (meta.print == null) {
      meta.print = (text) => {
        if (typeof text === "object" && (this.runner != null)) {
          text = this.runner.toString(text);
        }
        return console.info(text);
      };
    }
    Array.prototype.insert = function(e) {
      this.splice(0, 0, e);
      return e;
    };
    Array.prototype.insertAt = function(e, i) {
      if (i >= 0 && i < this.length) {
        this.splice(i, 0, e);
      } else {
        this.push(e);
      }
      return e;
    };
    Array.prototype.remove = function(i) {
      if (i >= 0 && i < this.length) {
        return this.splice(i, 1)[0];
      } else {
        return 0;
      }
    };
    Array.prototype.removeAt = function(i) {
      if (i >= 0 && i < this.length) {
        return this.splice(i, 1)[0];
      } else {
        return 0;
      }
    };
    Array.prototype.removeElement = function(e) {
      var index;
      index = this.indexOf(e);
      if (index >= 0) {
        return this.splice(index, 1)[0];
      } else {
        return 0;
      }
    };
    Array.prototype.contains = function(e) {
      if (this.indexOf(e) >= 0) {
        return 1;
      } else {
        return 0;
      }
    };
    meta.round = function(x) {
      return Math.round(x);
    };
    meta.floor = function(x) {
      return Math.floor(x);
    };
    meta.ceil = function(x) {
      return Math.ceil(x);
    };
    meta.abs = function(x) {
      return Math.abs(x);
    };
    meta.min = function(x, y) {
      return Math.min(x, y);
    };
    meta.max = function(x, y) {
      return Math.max(x, y);
    };
    meta.sqrt = function(x) {
      return Math.sqrt(x);
    };
    meta.pow = function(x, y) {
      return Math.pow(x, y);
    };
    meta.sin = function(x) {
      return Math.sin(x);
    };
    meta.cos = function(x) {
      return Math.cos(x);
    };
    meta.tan = function(x) {
      return Math.tan(x);
    };
    meta.acos = function(x) {
      return Math.acos(x);
    };
    meta.asin = function(x) {
      return Math.asin(x);
    };
    meta.atan = function(x) {
      return Math.atan(x);
    };
    meta.atan2 = function(y, x) {
      return Math.atan2(y, x);
    };
    meta.sind = function(x) {
      return Math.sin(x / 180 * Math.PI);
    };
    meta.cosd = function(x) {
      return Math.cos(x / 180 * Math.PI);
    };
    meta.tand = function(x) {
      return Math.tan(x / 180 * Math.PI);
    };
    meta.acosd = function(x) {
      return Math.acos(x) * 180 / Math.PI;
    };
    meta.asind = function(x) {
      return Math.asin(x) * 180 / Math.PI;
    };
    meta.atand = function(x) {
      return Math.atan(x) * 180 / Math.PI;
    };
    meta.atan2d = function(y, x) {
      return Math.atan2(y, x) * 180 / Math.PI;
    };
    meta.log = function(x) {
      return Math.log(x);
    };
    meta.exp = function(x) {
      return Math.exp(x);
    };
    meta.random = new Random(0);
    meta.PI = Math.PI;
    meta.true = 1;
    meta.false = 0;
    global.system = {
      time: Date.now,
      language: navigator.language,
      update_rate: 60,
      inputs: {
        keyboard: 1,
        mouse: 1,
        touch: "ontouchstart" in window ? 1 : 0,
        gamepad: 0
      },
      prompt: (text, callback) => {
        return setTimeout((() => {
          var args, result;
          global.mouse.pressed = 0;
          global.touch.touching = 0;
          result = window.prompt(text);
          if ((callback != null) && typeof callback === "function") {
            args = [(result != null ? 1 : 0), result];
            this.context.timeout = Date.now() + 1000;
            return callback.apply(null, args);
          }
        }), 0);
      },
      say: (text) => {
        return setTimeout((() => {
          return window.alert(text);
        }), 0);
      }
    };
    try {
      global.system.inputs.keyboard = window.matchMedia("(pointer:fine)").matches ? 1 : 0;
      global.system.inputs.mouse = window.matchMedia("(any-hover:none)").matches ? 0 : 1;
    } catch (error1) {
      err = error1;
    }
    this.storage_service = this.createStorageService();
    global.storage = this.storage_service.api;
    meta.global = global;
    this.context = {
      meta: meta,
      global: global,
      local: global,
      object: global,
      breakable: 0,
      continuable: 0,
      returnable: 0,
      stack_size: 0
    };
    ctx = this.context;
    Array.prototype.sortList = function(f) {
      var funk;
      if ((f != null) && f instanceof Program.Function) {
        funk = function(a, b) {
          return f.call(ctx, [a, b], true);
        };
      } else if ((f != null) && typeof f === "function") {
        funk = f;
      }
      return this.sort(funk);
    };
    this.clearWarnings();
    this.runner = new Runner(this);
  }

  clearWarnings() {
    return this.context.warnings = {
      using_undefined_variable: {},
      assigning_field_to_undefined: {},
      invoking_non_function: {},
      assigning_api_variable: {},
      assignment_as_condition: {}
    };
  }

  setMeta(key, value) {
    return this.context.meta[key] = value;
  }

  setGlobal(key, value) {
    return this.context.global[key] = value;
  }

  run(program, timeout = 3000, filename = "", callback) {
    var err, res;
    this.program = program;
    this.error_info = null;
    this.context.timeout = Date.now() + timeout;
    this.context.stack_size = 0;
    try {
      res = this.runner.run(this.program, filename, callback);
      this.storage_service.check();
      if (res != null) {
        return this.runner.toString(res);
      } else {
        return null;
      }
    } catch (error1) {
      err = error1;
      if ((err.type != null) && (err.line != null) && (err.error != null)) {
        this.error_info = err;
      } else if ((this.context.location != null) && (this.context.location.token != null)) {
        this.error_info = {
          error: this.context.location.token.error_text || err,
          file: filename,
          line: this.context.location.token.line,
          column: this.context.location.token.column
        };
        console.info(`Error at line: ${this.context.location.token.line} column: ${this.context.location.token.column}`);
      } else {
        this.error_info = {
          error: err,
          file: filename
        };
      }
      console.error(err);
      return this.storage_service.check();
    }
  }

  call(name, args = [], timeout = 3000) {
    var err, res;
    this.error_info = null;
    this.context.timeout = Date.now() + timeout;
    this.context.stack_size = 0;
    try {
      res = this.runner.call(name, args);
      this.storage_service.check();
      return res;
    } catch (error1) {
      err = error1;
      console.error(err);
      if ((this.context.location != null) && (this.context.location.token != null)) {
        this.error_info = {
          error: this.context.location.token.error_text || err,
          line: this.context.location.token.line,
          column: this.context.location.token.column,
          file: this.context.location.token.file
        };
      } else {
        this.error_info = {
          error: err
        };
      }
      if ((this.context.location != null) && (this.context.location.token != null)) {
        console.info(`Error at line: ${this.context.location.token.line} column: ${this.context.location.token.column}`);
      }
      return this.storage_service.check();
    }
  }

  createStorageService() {
    var err, error, ls, namespace, s, service, storage, write_storage;
    try {
      ls = window.localStorage;
    } catch (error1) {
      error = error1; // in incognito mode, embedded by an iframe, localStorage isn't available
      console.info("localStorage not available");
      return service = {
        api: {
          set: function() {},
          get: function() {
            return 0;
          }
        },
        check: function() {}
      };
    }
    if (!this.preserve_ls) {
      try {
        delete window.localStorage;
      } catch (error1) {
        err = error1;
      }
    }
    storage = {};
    write_storage = false;
    namespace = this.namespace;
    try {
      s = ls.getItem(`ms${namespace}`);
      if (s) {
        storage = JSON.parse(s);
      }
    } catch (error1) {
      err = error1;
    }
    return service = {
      api: {
        set: (name, value) => {
          value = this.storableObject(value);
          if ((name != null) && (value != null)) {
            storage[name] = value;
            write_storage = true;
          }
          return value;
        },
        get: (name) => {
          if (name != null) {
            if (storage[name] != null) {
              return storage[name];
            } else {
              return 0;
            }
          } else {
            return 0;
          }
        }
      },
      check: () => {
        if (write_storage) {
          write_storage = false;
          try {
            return ls.setItem(`ms${namespace}`, JSON.stringify(storage));
          } catch (error1) {
            err = error1;
          }
        }
      }
    };
  }

  storableObject(value) {
    var referenced;
    referenced = [this.context.global.screen, this.context.global.system, this.context.global.keyboard, this.context.global.audio, this.context.global.gamepad, this.context.global.touch, this.context.global.mouse, this.context.global.sprites, this.context.global.maps];
    return this.makeStorableObject(value, referenced);
  }

  makeStorableObject(value, referenced) {
    var i, j, key, len, res, v;
    if (value == null) {
      return value;
    }
    if (typeof value === "function" || ((typeof Program !== "undefined" && Program !== null) && value instanceof Program.Function) || ((typeof Routine !== "undefined" && Routine !== null) && value instanceof Routine)) {
      return void 0;
    } else if (typeof value === "object") {
      if (referenced.indexOf(value) >= 0) {
        return void 0;
      }
      referenced = referenced.slice();
      referenced.push(value);
      if (Array.isArray(value)) {
        res = [];
        for (i = j = 0, len = value.length; j < len; i = ++j) {
          v = value[i];
          v = this.makeStorableObject(v, referenced);
          if (v != null) {
            res[i] = v;
          }
        }
        return res;
      } else {
        res = {};
        for (key in value) {
          v = value[key];
          if (key === "class") {
            continue;
          }
          v = this.makeStorableObject(v, referenced);
          if (v != null) {
            res[key] = v;
          }
        }
        return res;
      }
    } else {
      return value;
    }
  }

};

this.Watcher = class Watcher {
  constructor(runtime) {
    this.runtime = runtime;
    this.vm = this.runtime.vm;
  }

  update() {
    if (this.watching_variables) {
      return this.step();
    }
  }

  watch(variables) {
    this.watching = true;
    this.watching_variables = variables;
    this.exclusion_list = [this.vm.context.global.screen, this.vm.context.global.system, this.vm.context.global.keyboard, this.vm.context.global.audio, this.vm.context.global.gamepad, this.vm.context.global.touch, this.vm.context.global.mouse, this.vm.context.global.sprites, this.vm.context.global.maps, this.vm.context.global.sounds, this.vm.context.global.music, this.vm.context.global.assets, this.vm.context.global.asset_manager, this.vm.context.global.fonts, this.vm.context.global.storage];
    if (this.vm.context.global.Function != null) {
      this.exclusion_list.push(this.vm.context.global.Function);
    }
    if (this.vm.context.global.String != null) {
      this.exclusion_list.push(this.vm.context.global.String);
    }
    if (this.vm.context.global.List != null) {
      this.exclusion_list.push(this.vm.context.global.List);
    }
    if (this.vm.context.global.Number != null) {
      this.exclusion_list.push(this.vm.context.global.Number);
    }
    if (this.vm.context.global.Object != null) {
      this.exclusion_list.push(this.vm.context.global.Object);
    }
    if (this.vm.context.global.Image != null) {
      this.exclusion_list.push(this.vm.context.global.Image);
    }
    if (this.vm.context.global.Sound != null) {
      this.exclusion_list.push(this.vm.context.global.Sound);
    }
    if (this.vm.context.global.Sprite != null) {
      this.exclusion_list.push(this.vm.context.global.Sprite);
    }
    if (this.vm.context.global.Map != null) {
      this.exclusion_list.push(this.vm.context.global.Map);
    }
    if (this.vm.context.global.random != null) {
      this.exclusion_list.push(this.vm.context.global.random);
    }
    if (this.vm.context.global.print != null) {
      this.exclusion_list.push(this.vm.context.global.print);
    }
    return this.step();
  }

  stop() {
    return this.watching = false;
  }

  step(variables = this.watching_variables) {
    var index, j, len, res, v, value, vs;
    if (!this.watching) {
      return;
    }
    res = {};
    for (j = 0, len = variables.length; j < len; j++) {
      v = variables[j];
      if (v === "global") {
        value = this.vm.context.global;
      } else {
        vs = v.split(".");
        value = this.vm.context.global;
        index = 0;
        while (index < vs.length && (value != null)) {
          value = value[vs[index++]];
        }
      }
      if ((value != null) && this.exclusion_list.indexOf(value) < 0) {
        res[v] = this.exploreValue(value, 1, 10);
      }
    }
    return this.runtime.listener.postMessage({
      name: "watch_update",
      data: res
    });
  }

  exploreValue(value, depth = 1, array_max = 10) {
    var i, j, key, len, res, v;
    if (value == null) {
      return {
        type: "number",
        value: 0
      };
    }
    if (typeof value === "function" || value instanceof Program.Function || (typeof Routine !== "undefined" && Routine !== null) && value instanceof Routine) {
      return {
        type: "function",
        value: ""
      };
    } else if (typeof value === "object") {
      if (Array.isArray(value)) {
        if (depth === 0) {
          return {
            type: "list",
            value: "",
            length: value.length
          };
        }
        res = [];
        for (i = j = 0, len = value.length; j < len; i = ++j) {
          v = value[i];
          if (i >= 100) {
            break;
          }
          if (this.exclusion_list.indexOf(v) < 0) {
            res[i] = this.exploreValue(v, depth - 1, array_max);
          }
        }
        return res;
      } else {
        if (depth === 0) {
          v = "";
          if (value.classname) {
            v = "class " + value.classname;
          }
          if ((value.class != null) && (value.class.classname != null)) {
            v = value.class.classname;
          }
          return {
            type: "object",
            value: v
          };
        }
        res = {};
        for (key in value) {
          v = value[key];
          if (this.exclusion_list.indexOf(v) < 0) {
            res[key] = this.exploreValue(v, depth - 1, array_max);
          }
        }
        return res;
      }
    } else if (typeof value === "string") {
      return {
        type: "string",
        value: value.length < 43 ? value : value.substring(0, 40) + "..."
      };
    } else if (typeof value === "number") {
      return {
        type: "number",
        value: isFinite(value) ? value : 0
      };
    } else if (typeof value === "boolean") {
      return {
        type: "number",
        value: value ? 1 : 0
      };
    } else {
      return {
        type: "unknown",
        value: value
      };
    }
  }

};

this.AssetManager = class AssetManager {
  constructor(runtime) {
    this.runtime = runtime;
    this.interface = {
      loadFont: (font) => {
        return this.loadFont(font);
      },
      loadModel: (path, scene, callback) => {
        return this.loadModel(path, scene, callback);
      },
      loadImage: (path, callback) => {
        return this.loadImage(path, callback);
      },
      loadJSON: (path, callback) => {
        return this.loadJSON(path, callback);
      },
      loadText: (path, callback) => {
        return this.loadText(path, callback);
      },
      loadCSV: (path, callback) => {
        return this.loadCSV(path, callback);
      },
      loadMarkdown: (path, callback) => {
        return this.loadMarkdown(path, callback);
      },
      wasmInstance: (path, callback) => {
        return this.wasmInstance(path, callback);
      }
    };
  }

  getInterface() {
    return this.interface;
  }

  loadFont(font) {
    var err, file, name, split;
    if (typeof font !== "string") {
      return;
    }
    file = font.replace(/\//g, "-");
    split = file.split("-");
    name = split[split.length - 1];
    try {
      font = new FontFace(name, `url(assets/${file}.ttf)`);
      return font.load().then(() => {
        return document.fonts.add(font);
      });
    } catch (error) {
      err = error;
      return console.error(err);
    }
  }

  loadModel(path, scene, callback) {
    var loader;
    if (typeof BABYLON === "undefined" || BABYLON === null) {
      return;
    }
    loader = {
      ready: 0
    };
    if (this.runtime.assets[path] != null) {
      path = this.runtime.assets[path].file;
    } else {
      path = path.replace(/\//g, "-");
      path += ".glb";
    }
    return BABYLON.SceneLoader.LoadAssetContainer("", `assets/${path}`, scene, (container) => {
      loader.container = container;
      loader.ready = 1;
      if (callback) {
        return callback(container);
      }
    });
  }

  loadImage(path, callback) {
    var img, loader;
    loader = {
      ready: 0
    };
    if (this.runtime.assets[path] != null) {
      path = this.runtime.assets[path].file;
    }
    img = new Image;
    img.src = `assets/${path}`;
    img.onload = () => {
      var i;
      i = new msImage(img);
      loader.image = i;
      loader.ready = 1;
      if (callback) {
        return callback(i);
      }
    };
    return loader;
  }

  loadJSON(path, callback) {
    var loader;
    path = path.replace(/\//g, "-");
    path = `assets/${path}.json`;
    loader = {
      ready: 0
    };
    fetch(path).then((result) => {
      return result.json().then((data) => {
        loader.data = data;
        loader.ready = 1;
        if (callback) {
          return callback(data);
        }
      });
    });
    return loader;
  }

  loadText(path, callback, ext = "txt") {
    var loader;
    path = path.replace(/\//g, "-");
    path = `assets/${path}.${ext}`;
    loader = {
      ready: 0
    };
    fetch(path).then((result) => {
      return result.text().then((text) => {
        loader.text = text;
        loader.ready = 1;
        if (callback) {
          return callback(text);
        }
      });
    });
    return loader;
  }

  loadCSV(path, callback) {
    return this.loadText(path, callback, "csv");
  }

  loadMarkdown(path, callback) {
    return this.loadText(path, callback, "md");
  }

  wasmInstance(path, callback) {
    var loader;
    path = path.replace(/\//g, "-");
    path = `assets/${path}.wasm`;
    loader = {
      ready: 0
    };
    fetch(path).then((response) => {
      return response.arrayBuffer().then((buffer) => {
        return WebAssembly.instantiate(buffer).then((result) => {
          loader.instance = result.instance;
          loader.ready = 1;
          if (callback) {
            return callback(loader.instance);
          }
        });
      });
    });
    return loader;
  }

};

var WebSocket;

WebSocket = require("ws");

this.MPServer = class MPServer {
  constructor() {
    var impl;
    impl = new MPServerImpl(this);
    this.send = function(data) {
      var err;
      try {
        impl.sendMessage(data);
        return "sent";
      } catch (error) {
        err = error;
        console.error(err);
        return err.toString();
      }
    };
    this.close = function() {
      var err;
      try {
        return impl.close();
      } catch (error) {
        err = error;
        return console.error(err);
      }
    };
    this.new_connections = [];
    this.active_connections = [];
    this.closed_connections = [];
    this.messages = [];
    player.runtime.addServer(impl);
  }

};

this.MPServerImpl = class MPServerImpl {
  constructor(_interface) {
    this.interface = _interface;
    this.interface.status = "starting";
    this.reconnect_delay = 1000;
    this.clients = {};
    this.clients_connected = [];
    this.clients_disconnected = {};
    this.client_id = 1;
    this.start();
  }

  start() {
    var err;
    try {
      this.server = new WebSocket.Server({
        port: server_port
      });
      return this.server.on("connection", (socket, request) => {
        return this.clientConnected(socket);
      });
    } catch (error) {
      err = error;
      return console.error(err);
    }
  }

  clientConnected(socket) {
    var client;
    client = new MPClient(this, socket, this.client_id);
    this.clients_connected.push(client);
    this.clients[this.client_id] = client;
    return this.client_id++;
  }

  clientMessage(msg) {
    var client;
    if (msg.client_id == null) {
      return;
    }
    client = this.clients[msg.client_id];
    if (client != null) {
      return client.message(msg.data);
    }
  }

  clientDisconnected(client) {
    delete this.clients[client.client_id];
    return this.clients_disconnected[client.client_id] = true;
  }

  sendMessage(data) {
    return this.send({
      name: "mp_server_message",
      data: data
    });
  }

  send(data) {
    return this.socket.send(JSON.stringify(data));
  }

  update() {
    var c, client, closed_connections, connection, i, id, j, k, l, len, len1, len2, m, messages, n, new_connections, ref, ref1, ref2, ref3, ref4;
    new_connections = [];
    closed_connections = [];
    for (i = j = ref = this.interface.active_connections.length - 1; j >= 0; i = j += -1) {
      c = this.interface.active_connections[i];
      if (this.clients_disconnected[c.id]) {
        this.interface.active_connections.splice(i, 1);
        closed_connections.push(c);
      }
    }
    ref1 = this.clients_connected;
    for (k = 0, len = ref1.length; k < len; k++) {
      c = ref1[k];
      new_connections.push(c.interface);
      this.interface.active_connections.push(c.interface);
    }
    this.interface.new_connections = new_connections;
    this.interface.closed_connections = closed_connections;
    this.clients_disconnected = {};
    this.clients_connected = [];
    ref2 = this.clients;
    for (id in ref2) {
      client = ref2[id];
      client.update();
    }
    messages = [];
    ref3 = this.interface.active_connections;
    for (l = 0, len1 = ref3.length; l < len1; l++) {
      connection = ref3[l];
      ref4 = connection.messages;
      for (n = 0, len2 = ref4.length; n < len2; n++) {
        m = ref4[n];
        messages.push(m);
      }
    }
    this.interface.messages = messages;
  }

  close() {
    return this.socket.close();
  }

};

this.MPClient = class MPClient {
  constructor(server, socket1, client_id) {
    this.server = server;
    this.socket = socket1;
    this.client_id = client_id;
    this.interface = {
      id: this.client_id,
      status: "connected",
      messages: [],
      send: (data) => {
        return this.sendMessage(data);
      },
      disconnect: () => {
        return this.disconnect();
      }
    };
    this.message_buffer = [];
    this.socket.onmessage = (msg) => {
      var err;
      try {
        // console.info msg.data
        msg = JSON.parse(msg.data);
        switch (msg.name) {
          case "mp_update":
            this.interface.status = "running";
            return player.runtime.timer();
          case "mp_client_connection":
            return this.clientConnected(msg);
          case "mp_client_message":
            return this.clientMessage(msg);
          case "mp_client_disconnected":
            return this.disconnected();
        }
      } catch (error) {
        err = error;
        return console.error(err);
      }
    };
    this.socket.onclose = () => {
      return this.server.clientDisconnected(this);
    };
  }

  clientConnected(msg) {}

  clientMessage(msg) {
    return this.message_buffer.push(msg.data);
  }

  sendMessage(data) {
    var err;
    try {
      return this.socket.send(JSON.stringify({
        name: "mp_server_message",
        data: data
      }));
    } catch (error) {
      err = error;
      return console.error(err);
    }
  }

  disconnect() {
    var err;
    try {
      return this.socket.close();
    } catch (error) {
      err = error;
      return console.error(err);
    }
  }

  message(msg) {
    return this.message_buffer.push(msg.data);
  }

  disconnected() {
    return this.interface.status = "disconnected";
  }

  update() {
    var j, len, m, messages, ref;
    messages = [];
    ref = this.message_buffer;
    for (j = 0, len = ref.length; j < len; j++) {
      m = ref[j];
      messages.push({
        connection: this.interface,
        data: m
      });
    }
    this.interface.messages = messages;
    return this.message_buffer = [];
  }

};

this.Runtime = class Runtime {
  constructor(url1, sources, resources, listener) {
    this.url = url1;
    this.sources = sources;
    this.resources = resources;
    this.listener = listener;
    this.sprites = {};
    this.maps = {};
    this.sounds = {};
    this.music = {};
    this.assets = {};
    this.asset_manager = new AssetManager(this);
    this.previous_init = null;
    this.report_errors = true;
    this.log = (text) => {
      return this.listener.log(text);
    };
    this.update_memory = {};
    this.servers = [];
  }

  addServer(server) {
    return this.servers.push(server);
  }

  updateSource(file, src, reinit = false) {
    var err, init;
    if (this.vm == null) {
      return false;
    }
    if (src === this.update_memory[file]) {
      return false;
    }
    this.update_memory[file] = src;
    try {
      this.vm.run(src, 3000, file);
      this.listener.postMessage({
        name: "compile_success",
        file: file
      });
      this.reportWarnings();
      if (this.vm.error_info != null) {
        err = this.vm.error_info;
        err.type = "init";
        err.file = file;
        this.listener.reportError(err);
        return false;
      }
      if (this.vm.runner.getFunctionSource != null) {
        init = this.vm.runner.getFunctionSource("serverInit");
        if ((init != null) && init !== this.previous_init && reinit) {
          this.previous_init = init;
          this.vm.call("serverInit");
          if (this.vm.error_info != null) {
            err = this.vm.error_info;
            err.type = "serverInit";
            this.listener.reportError(err);
          }
        }
      }
      return true;
    } catch (error) {
      err = error;
      if (this.report_errors) {
        console.error(err);
        err.file = file;
        this.listener.reportError(err);
        return false;
      }
    }
  }

  start() {
    var j, key, len, m, name, ref, ref1, value;
    if (window.ms_async_load) {
      this.startReady();
    }
    if (Array.isArray(this.resources.maps)) {
      ref = this.resources.maps;
      for (j = 0, len = ref.length; j < len; j++) {
        m = ref[j];
        name = m.file.split(".")[0].replace(/-/g, "/");
        this.maps[name] = LoadMap(this.url + `maps/${m.file}?v=${m.version}`, () => {
          return this.checkStartReady();
        });
        this.maps[name].name = name;
      }
    } else if (this.resources.maps != null) {
      if (window.player == null) {
        window.player = this.listener;
      }
      ref1 = this.resources.maps;
      for (key in ref1) {
        value = ref1[key];
        this.updateMap(key, 0, value);
      }
    }
    this.checkStartReady();
  }

  checkStartReady() {
    var count, key, ready, ref, value;
    count = 0;
    ready = 0;
    ref = this.maps;
    for (key in ref) {
      value = ref[key];
      count += 1;
      if (value.ready) {
        ready += 1;
      }
    }
    if (ready < count) {
      if (!window.ms_async_load) {
        return;
      }
    } else {
      if (window.ms_async_load && (this.vm != null)) {
        this.vm.context.global.system.loading = 100;
      }
    }
    if (!this.started) {
      return this.startReady();
    }
  }

  startReady() {
    var err, file, global, init, j, len, lib, meta, namespace, ref, ref1, src;
    this.started = true;
    meta = {
      print: (text) => {
        if ((typeof text === "object" || typeof text === "function") && (this.vm != null)) {
          text = this.vm.runner.toString(text);
        }
        return this.listener.log(text);
      }
    };
    global = {
      sprites: this.sprites,
      sounds: this.sounds,
      music: this.music,
      assets: this.assets,
      asset_manager: this.asset_manager.getInterface(),
      maps: this.maps,
      Map: MicroMap
    };
    ref = window.ms_libs;
    for (j = 0, len = ref.length; j < len; j++) {
      lib = ref[j];
      switch (lib) {
        case "matterjs":
          global.Matter = Matter;
          break;
        case "cannonjs":
          global.CANNON = CANNON;
      }
    }
    namespace = location.pathname + "[server]";
    this.vm = new MicroVM(meta, global, namespace, location.hash === "#transpiler");
    this.vm.context.global.Server = MPServer;
    this.vm.context.global.auth_register = function(username, password) { return auth.register(username, password); };
    this.vm.context.global.auth_login = function(username, password) { return auth.login(username, password); };
    this.vm.context.global.auth_validate = function(token) { return auth.validateToken(token); };
    this.vm.context.global.db_get_player = function(username) { return auth.getPlayerData(username); };
    this.vm.context.global.db_save_player = function(username, data) { return auth.savePlayerData(username, data); };
    this.vm.context.global.db_reset_player = function(username) { return auth.resetPlayerData(username); };
    this.vm.context.global.system.pause = () => {
      return this.listener.codePaused();
    };
    this.vm.context.global.system.exit = () => {
      return this.exit();
    };
    if (!window.ms_async_load) {
      this.vm.context.global.system.loading = 100;
    }
    this.vm.context.global.system.javascript = System.javascript;
    System.runtime = this;
    ref1 = this.sources;
    for (file in ref1) {
      src = ref1[file];
      this.updateSource(file, src, false);
    }
    if (this.vm.runner.getFunctionSource != null) {
      init = this.vm.runner.getFunctionSource("serverInit");
      if (init != null) {
        this.previous_init = init;
        this.vm.call("serverInit");
        if (this.vm.error_info != null) {
          err = this.vm.error_info;
          err.type = "serverInit";
          this.listener.reportError(err);
        }
      }
    } else {
      this.vm.call("serverInit");
      if (this.vm.error_info != null) {
        err = this.vm.error_info;
        err.type = "serverInit";
        this.listener.reportError(err);
      }
    }
    this.dt = 1000 / 60;
    this.last_time = Date.now();
    this.current_frame = 0;
    this.floating_frame = 0;
    this.clock_interval = setInterval((() => {
      return this.clock();
    }), 16);
    this.watcher = new Watcher(this);
    return this.listener.postMessage({
      name: "started"
    });
  }

  updateMaps() {
    var key, map, ref;
    ref = this.maps;
    for (key in ref) {
      map = ref[key];
      map.needs_update = true;
    }
  }

  runCommand(command, callback) {
    var err, res, warnings;
    try {
      warnings = this.vm.context.warnings;
      this.vm.clearWarnings();
      res = this.vm.run(command, void 0, void 0, callback);
      this.reportWarnings();
      this.vm.context.warnings = warnings;
      if (this.vm.error_info != null) {
        err = this.vm.error_info;
        err.type = "exec";
        this.listener.reportError(err);
      }
      this.watcher.update();
      if (callback == null) {
        return res;
      } else if (res != null) {
        callback(res);
      }
      return null;
    } catch (error) {
      err = error;
      return this.listener.reportError(err);
    }
  }

  projectFileUpdated(type, file, version, data, properties) {
    switch (type) {
      case "maps":
        return this.updateMap(file, version, data);
      case "ms":
        return this.updateCode(file, version, data);
    }
  }

  projectFileDeleted(type, file) {
    switch (type) {
      case "maps":
        return delete this.maps[file.substring(0, file.length - 5).replace(/-/g, "/")];
    }
  }

  projectOptionsUpdated(msg) {}

  updateMap(name, version, data) {
    var m, url;
    name = name.replace(/-/g, "/");
    if (data != null) {
      m = this.maps[name];
      if (m != null) {
        UpdateMap(m, data);
        return m.needs_update = true;
      } else {
        m = new MicroMap(1, 1, 1, 1);
        UpdateMap(m, data);
        this.maps[name] = m;
        return this.maps[name].name = name;
      }
    } else {
      url = this.url + `maps/${name}.json?v=${version}`;
      m = this.maps[name];
      if (m != null) {
        return m.loadFile(url);
      } else {
        this.maps[name] = LoadMap(url);
        return this.maps[name].name = name;
      }
    }
  }

  updateCode(name, version, data) {
    var req, url;
    if (data != null) {
      this.sources[name] = data;
      if ((this.vm != null) && data !== this.update_memory[name]) {
        this.vm.clearWarnings();
      }
      return this.updateSource(name, data, true);
    } else {
      url = this.url + `ms/${name}.ms?v=${version}`;
      req = new XMLHttpRequest();
      req.onreadystatechange = (event) => {
        if (req.readyState === XMLHttpRequest.DONE) {
          if (req.status === 200) {
            this.sources[name] = req.responseText;
            return this.updateSource(name, this.sources[name], true);
          }
        }
      };
      req.open("GET", url);
      return req.send();
    }
  }

  stop() {
    this.stopped = true;
    clearInterval(this.clock_interval);
    return this.audio.cancelBeeps();
  }

  stepForward() {
    if (this.stopped) {
      this.updateCall();
      if (this.vm.runner.tick != null) {
        this.vm.runner.tick();
      }
      return this.watcher.update();
    }
  }

  resume() {
    if (this.stopped) {
      this.stopped = false;
      return this.clock_interval = setInterval((() => {
        return this.clock();
      }), 16);
    }
  }

  clock() {
    return this.timer();
  }

  timer() {
    var ds, dt, fps, i, j, ref, time;
    if (this.stopped) {
      return;
    }
    time = Date.now();
    if (Math.abs(time - this.last_time) > 160) {
      this.last_time = time - 16;
    }
    dt = time - this.last_time;
    this.dt = this.dt * .9 + dt * .1;
    this.last_time = time;
    this.vm.context.global.system.fps = Math.round(fps = 1000 / this.dt);
    this.floating_frame += this.dt * 60 / 1000;
    ds = Math.min(10, Math.round(this.floating_frame - this.current_frame));
    for (i = j = 1, ref = ds; j <= ref; i = j += 1) {
      this.updateCall();
      if (this.vm.runner.tick != null) {
        this.vm.runner.tick();
      }
    }
    this.current_frame += ds;
    if (ds > 0) {
      return this.watcher.update();
    }
  }

  updateControls() {
    var j, len, ref, results, s;
    ref = this.servers;
    results = [];
    for (j = 0, len = ref.length; j < len; j++) {
      s = ref[j];
      results.push(s.update());
    }
    return results;
  }

  updateCall() {
    var err;
    if (this.vm.runner.triggers_controls_update) {
      if (this.vm.runner.updateControls == null) {
        this.vm.runner.updateControls = () => {
          return this.updateControls();
        };
      }
    } else {
      this.updateControls();
    }
    try {
      this.vm.call("serverUpdate");
      this.reportWarnings();
      if (this.vm.error_info != null) {
        err = this.vm.error_info;
        err.type = "serverUpdate";
        return this.listener.reportError(err);
      }
    } catch (error) {
      err = error;
      if (this.report_errors) {
        return this.listener.reportError(err);
      }
    }
  }

  reportWarnings() {
    var key, ref, ref1, ref2, ref3, value;
    if (this.vm != null) {
      ref = this.vm.context.warnings.invoking_non_function;
      for (key in ref) {
        value = ref[key];
        if (!value.reported) {
          value.reported = true;
          this.listener.reportError({
            error: "",
            type: "non_function",
            expression: value.expression,
            line: value.line,
            column: value.column,
            file: value.file
          });
        }
      }
      ref1 = this.vm.context.warnings.using_undefined_variable;
      for (key in ref1) {
        value = ref1[key];
        if (!value.reported) {
          value.reported = true;
          this.listener.reportError({
            error: "",
            type: "undefined_variable",
            expression: value.expression,
            line: value.line,
            column: value.column,
            file: value.file
          });
        }
      }
      ref2 = this.vm.context.warnings.assigning_field_to_undefined;
      for (key in ref2) {
        value = ref2[key];
        if (!value.reported) {
          value.reported = true;
          this.listener.reportError({
            error: "",
            type: "assigning_undefined",
            expression: value.expression,
            line: value.line,
            column: value.column,
            file: value.file
          });
        }
      }
      ref3 = this.vm.context.warnings.assigning_api_variable;
      for (key in ref3) {
        value = ref3[key];
        if (!value.reported) {
          value.reported = true;
          this.listener.reportError({
            error: "",
            type: "assigning_api_variable",
            expression: value.expression,
            line: value.line,
            column: value.column,
            file: value.file
          });
        }
      }
    }
  }

  exit() {
    var err;
    this.stop();
    try {
      // microStudio embedded exit
      this.listener.exit();
    } catch (error) {
      err = error;
    }
    try {
      // TODO: Cordova exit, this might work
      if ((navigator.app != null) && (navigator.app.exitApp != null)) {
        navigator.app.exitApp();
      }
    } catch (error) {
      err = error;
    }
    try {
      // TODO: Electron exit, may already be covered by window.close()

      // Windowed mode exit
      return window.close();
    } catch (error) {
      err = error;
    }
  }

};

this.System = {
  javascript: function(s) {
    var err, f, res;
    try {
      f = eval(`res = function(global) { ${s} }`);
      res = f.call(player.runtime.vm.context.global, player.runtime.vm.context.global);
    } catch (error) {
      err = error;
      console.error(err);
    }
    if (res != null) {
      return res;
    } else {
      return 0;
    }
  }
};

this.Watcher = class Watcher {
  constructor(runtime) {
    this.runtime = runtime;
    this.vm = this.runtime.vm;
  }

  update() {
    if (this.watching_variables) {
      return this.step();
    }
  }

  watch(variables) {
    this.watching = true;
    this.watching_variables = variables;
    this.exclusion_list = [this.vm.context.global.screen, this.vm.context.global.system, this.vm.context.global.keyboard, this.vm.context.global.audio, this.vm.context.global.gamepad, this.vm.context.global.touch, this.vm.context.global.mouse, this.vm.context.global.sprites, this.vm.context.global.maps, this.vm.context.global.sounds, this.vm.context.global.music, this.vm.context.global.assets, this.vm.context.global.asset_manager, this.vm.context.global.fonts, this.vm.context.global.storage];
    if (this.vm.context.global.Function != null) {
      this.exclusion_list.push(this.vm.context.global.Function);
    }
    if (this.vm.context.global.String != null) {
      this.exclusion_list.push(this.vm.context.global.String);
    }
    if (this.vm.context.global.List != null) {
      this.exclusion_list.push(this.vm.context.global.List);
    }
    if (this.vm.context.global.Number != null) {
      this.exclusion_list.push(this.vm.context.global.Number);
    }
    if (this.vm.context.global.Object != null) {
      this.exclusion_list.push(this.vm.context.global.Object);
    }
    if (this.vm.context.global.Image != null) {
      this.exclusion_list.push(this.vm.context.global.Image);
    }
    if (this.vm.context.global.Sound != null) {
      this.exclusion_list.push(this.vm.context.global.Sound);
    }
    if (this.vm.context.global.Sprite != null) {
      this.exclusion_list.push(this.vm.context.global.Sprite);
    }
    if (this.vm.context.global.Map != null) {
      this.exclusion_list.push(this.vm.context.global.Map);
    }
    if (this.vm.context.global.random != null) {
      this.exclusion_list.push(this.vm.context.global.random);
    }
    if (this.vm.context.global.print != null) {
      this.exclusion_list.push(this.vm.context.global.print);
    }
    return this.step();
  }

  stop() {
    return this.watching = false;
  }

  step(variables = this.watching_variables) {
    var index, j, len, res, v, value, vs;
    if (!this.watching) {
      return;
    }
    res = {};
    for (j = 0, len = variables.length; j < len; j++) {
      v = variables[j];
      if (v === "global") {
        value = this.vm.context.global;
      } else {
        vs = v.split(".");
        value = this.vm.context.global;
        index = 0;
        while (index < vs.length && (value != null)) {
          value = value[vs[index++]];
        }
      }
      if ((value != null) && this.exclusion_list.indexOf(value) < 0) {
        res[v] = this.exploreValue(value, 1, 10);
      }
    }
    return this.runtime.listener.postMessage({
      name: "watch_update",
      data: res
    });
  }

  exploreValue(value, depth = 1, array_max = 10) {
    var i, j, key, len, res, v;
    if (value == null) {
      return {
        type: "number",
        value: 0
      };
    }
    if (typeof value === "function" || value instanceof Program.Function || (typeof Routine !== "undefined" && Routine !== null) && value instanceof Routine) {
      return {
        type: "function",
        value: ""
      };
    } else if (typeof value === "object") {
      if (Array.isArray(value)) {
        if (depth === 0) {
          return {
            type: "list",
            value: "",
            length: value.length
          };
        }
        res = [];
        for (i = j = 0, len = value.length; j < len; i = ++j) {
          v = value[i];
          if (i >= 100) {
            break;
          }
          if (this.exclusion_list.indexOf(v) < 0) {
            res[i] = this.exploreValue(v, depth - 1, array_max);
          }
        }
        return res;
      } else {
        if (depth === 0) {
          v = "";
          if (value.classname) {
            v = "class " + value.classname;
          }
          if ((value.class != null) && (value.class.classname != null)) {
            v = value.class.classname;
          }
          return {
            type: "object",
            value: v
          };
        }
        res = {};
        for (key in value) {
          v = value[key];
          if (this.exclusion_list.indexOf(v) < 0) {
            res[key] = this.exploreValue(v, depth - 1, array_max);
          }
        }
        return res;
      }
    } else if (typeof value === "string") {
      return {
        type: "string",
        value: value.length < 43 ? value : value.substring(0, 40) + "..."
      };
    } else if (typeof value === "number") {
      return {
        type: "number",
        value: isFinite(value) ? value : 0
      };
    } else if (typeof value === "boolean") {
      return {
        type: "number",
        value: value ? 1 : 0
      };
    } else {
      return {
        type: "unknown",
        value: value
      };
    }
  }

};

this.MicroMap = (function() {
  function MicroMap(width, height, block_width, block_height) {
    this.width = width;
    this.height = height;
    this.block_width = block_width;
    this.block_height = block_height;
    this.sprites = window.player.runtime.sprites;
    this.map = [];
    this.ready = true;
    this.clear();
  }

  MicroMap.prototype.clear = function() {
    var i, j, k, l, ref1, ref2;
    for (j = k = 0, ref1 = this.height - 1; k <= ref1; j = k += 1) {
      for (i = l = 0, ref2 = this.width - 1; l <= ref2; i = l += 1) {
        this.map[i + j * this.width] = null;
      }
    }
  };

  MicroMap.prototype.set = function(x, y, ref) {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      if (typeof ref === "string") {
        ref = ref.replace(/\//g, "-");
      }
      this.map[x + y * this.width] = ref;
      return this.needs_update = true;
    }
  };

  MicroMap.prototype.get = function(x, y) {
    var c;
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return 0;
    }
    c = this.map[x + y * this.width];
    if (typeof c === "string") {
      c = c.replace(/-/g, "/");
    }
    return c || 0;
  };

  MicroMap.prototype.getCanvas = function() {
    if ((this.canvas == null) || this.needs_update) {
      this.update();
    }
    return this.canvas;
  };

  MicroMap.prototype.draw = function(context, x, y, w, h) {
    var a, c, ctx, k, len, len1, ref1, time;
    if ((this.animated != null) && this.animated.length > 0) {
      time = Date.now();
      if ((this.buffer == null) || this.buffer.width !== this.block_width * this.width || this.buffer.height !== this.block_height * this.height) {
        console.info("creating buffer");
        this.buffer = document.createElement("canvas");
        this.buffer.width = this.block_width * this.width;
        this.buffer.height = this.block_height * this.height;
      }
      ctx = this.buffer.getContext("2d");
      ctx.clearRect(0, 0, this.buffer.width, this.buffer.height);
      ctx.drawImage(this.getCanvas(), 0, 0);
      ref1 = this.animated;
      for (k = 0, len1 = ref1.length; k < len1; k++) {
        a = ref1[k];
        len = a.sprite.frames.length;
        c = a.sprite.frames[Math.floor(time / 1000 * a.sprite.fps) % len].canvas;
        if (a.tx != null) {
          ctx.drawImage(c, a.tx, a.ty, this.block_width, this.block_height, a.x, a.y, this.block_width, this.block_height);
        } else {
          ctx.drawImage(c, a.x, a.y, this.block_width, this.block_height);
        }
      }
      context.drawImage(this.buffer, x, y, w, h);
    } else {
      context.drawImage(this.getCanvas(), x, y, w, h);
    }
  };

  MicroMap.prototype.update = function() {
    var a, c, context, i, index, j, k, l, ref1, ref2, s, sprite, tx, ty, xy;
    this.needs_update = false;
    if (this.canvas == null) {
      this.canvas = document.createElement("canvas");
    }
    if (this.canvas.width !== this.width * this.block_width || this.canvas.height !== this.height * this.block_height) {
      this.canvas.width = this.width * this.block_width;
      this.canvas.height = this.height * this.block_height;
    }
    context = this.canvas.getContext("2d");
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.animated = [];
    for (j = k = 0, ref1 = this.height - 1; k <= ref1; j = k += 1) {
      for (i = l = 0, ref2 = this.width - 1; l <= ref2; i = l += 1) {
        index = i + (this.height - 1 - j) * this.width;
        s = this.map[index];
        if ((s != null) && s.length > 0) {
          s = s.split(":");
          sprite = this.sprites[s[0]];
          if (sprite == null) {
            sprite = this.sprites[s[0].replace(/-/g, "/")];
          }
          if ((sprite != null) && (sprite.frames[0] != null)) {
            if (sprite.frames.length > 1) {
              a = {
                x: this.block_width * i,
                y: this.block_height * j,
                w: this.block_width,
                h: this.block_height,
                sprite: sprite
              };
              if (s[1] != null) {
                xy = s[1].split(",");
                a.tx = xy[0] * this.block_width;
                a.ty = xy[1] * this.block_height;
              }
              this.animated.push(a);
              continue;
            }
            if (s[1] != null) {
              xy = s[1].split(",");
              tx = xy[0] * this.block_width;
              ty = xy[1] * this.block_height;
              c = sprite.frames[0].canvas;
              if ((c != null) && c.width > 0 && c.height > 0) {
                context.drawImage(c, tx, ty, this.block_width, this.block_height, this.block_width * i, this.block_height * j, this.block_width, this.block_height);
              }
            } else {
              c = sprite.frames[0].canvas;
              if ((c != null) && c.width > 0 && c.height > 0) {
                context.drawImage(c, this.block_width * i, this.block_height * j);
              }
            }
          }
        }
      }
    }
  };

  MicroMap.prototype.loadFile = function(url) {
    var req;
    req = new XMLHttpRequest();
    req.onreadystatechange = (function(_this) {
      return function(event) {
        if (req.readyState === XMLHttpRequest.DONE) {
          if (req.status === 200) {
            _this.load(req.responseText, _this.sprites);
            return _this.update();
          }
        }
      };
    })(this);
    req.open("GET", url);
    return req.send();
  };

  MicroMap.prototype.load = function(data, sprites) {
    var i, j, k, l, ref1, ref2, s;
    data = JSON.parse(data);
    this.width = data.width;
    this.height = data.height;
    this.block_width = data.block_width;
    this.block_height = data.block_height;
    for (j = k = 0, ref1 = data.height - 1; k <= ref1; j = k += 1) {
      for (i = l = 0, ref2 = data.width - 1; l <= ref2; i = l += 1) {
        s = data.data[i + j * data.width];
        if (s > 0) {
          this.map[i + j * data.width] = data.sprites[s];
        } else {
          this.map[i + j * data.width] = null;
        }
      }
    }
  };

  MicroMap.prototype.clone = function() {
    var i, j, k, l, map, ref1, ref2;
    map = new MicroMap(this.width, this.height, this.block_width, this.block_height, this.sprites);
    for (j = k = 0, ref1 = this.height - 1; k <= ref1; j = k += 1) {
      for (i = l = 0, ref2 = this.width - 1; l <= ref2; i = l += 1) {
        map.map[i + j * this.width] = this.map[i + j * this.width];
      }
    }
    map.needs_update = true;
    return map;
  };

  MicroMap.prototype.copyFrom = function(map) {
    var i, j, k, l, ref1, ref2;
    this.width = map.width;
    this.height = map.height;
    this.block_width = map.block_width;
    this.block_height = map.block_height;
    for (j = k = 0, ref1 = this.height - 1; k <= ref1; j = k += 1) {
      for (i = l = 0, ref2 = this.width - 1; l <= ref2; i = l += 1) {
        this.map[i + j * this.width] = map.map[i + j * this.width];
      }
    }
    this.update();
    return this;
  };

  return MicroMap;

})();

this.LoadMap = function(url, loaded) {
  var map, req;
  map = new MicroMap(1, 1, 1, 1);
  map.ready = false;
  req = new XMLHttpRequest();
  req.onreadystatechange = (function(_this) {
    return function(event) {
      if (req.readyState === XMLHttpRequest.DONE) {
        map.ready = true;
        if (req.status === 200) {
          UpdateMap(map, req.responseText);
        }
        map.needs_update = true;
        if (loaded != null) {
          return loaded();
        }
      }
    };
  })(this);
  req.open("GET", url);
  req.send();
  return map;
};

this.UpdateMap = function(map, data) {
  var i, j, k, l, ref1, ref2, s;
  data = JSON.parse(data);
  map.width = data.width;
  map.height = data.height;
  map.block_width = data.block_width;
  map.block_height = data.block_height;
  for (j = k = 0, ref1 = data.height - 1; k <= ref1; j = k += 1) {
    for (i = l = 0, ref2 = data.width - 1; l <= ref2; i = l += 1) {
      s = data.data[i + j * data.width];
      if (s > 0) {
        map.map[i + j * data.width] = data.sprites[s];
      } else {
        map.map[i + j * data.width] = null;
      }
    }
  }
  map.needs_update = true;
  return map;
};

this.SaveMap = function(map) {
  var data, i, index, j, k, l, list, m, n, o, ref1, ref2, ref3, ref4, s, table;
  index = 1;
  list = [0];
  table = {};
  for (j = k = 0, ref1 = map.height - 1; k <= ref1; j = k += 1) {
    for (i = l = 0, ref2 = map.width - 1; l <= ref2; i = l += 1) {
      s = map.map[i + j * map.width];
      if ((s != null) && s.length > 0 && (table[s] == null)) {
        list.push(s);
        table[s] = index++;
      }
    }
  }
  m = [];
  for (j = n = 0, ref3 = map.height - 1; n <= ref3; j = n += 1) {
    for (i = o = 0, ref4 = map.width - 1; o <= ref4; i = o += 1) {
      s = map.map[i + j * map.width];
      m[i + j * map.width] = (s != null) && s.length > 0 ? table[s] : 0;
    }
  }
  data = {
    width: map.width,
    height: map.height,
    block_width: map.block_width,
    block_height: map.block_height,
    sprites: list,
    data: m
  };
  return JSON.stringify(data);
};

this.Watch = (function() {
  function Watch(app) {
    var fn, i, len, ref, t;
    this.app = app;
    this.runwindow = this.app.runwindow;
    this.runwindow.addMessageListener("watch_update", (function(_this) {
      return function(msg) {
        return _this.watchUpdate(msg);
      };
    })(this));
    this.types = ["number", "string", "function", "object", "list"];
    ref = this.types;
    fn = (function(_this) {
      return function(t) {
        _this["filtered_type_" + t] = false;
        return document.getElementById("debug-watch-type-" + t).addEventListener("click", function() {
          _this["filtered_type_" + t] = !_this["filtered_type_" + t];
          if (_this["filtered_type_" + t]) {
            document.getElementById("debug-watch-type-" + t).classList.add("filtered");
          } else {
            document.getElementById("debug-watch-type-" + t).classList.remove("filtered");
          }
          return _this.updateFilters();
        });
      };
    })(this);
    for (i = 0, len = ref.length; i < len; i++) {
      t = ref[i];
      fn(t);
    }
    document.getElementById("debug-watch-filter").addEventListener("input", (function(_this) {
      return function() {
        _this.text_filter = document.getElementById("debug-watch-filter").value;
        return _this.updateFilters();
      };
    })(this));
    this.reset();
    this.app.runwindow.addListener((function(_this) {
      return function(event) {
        return _this.runtimeEvent(event);
      };
    })(this));
  }

  Watch.prototype.reset = function() {
    this.watch_lines = {};
    this.watch_list = ["global"];
    this.text_filter = "";
    document.getElementById("debug-watch-filter").value = "";
    return document.getElementById("debug-watch-content").innerHTML = "";
  };

  Watch.prototype.start = function() {
    this.started = true;
    return this.runwindow.postMessage({
      name: "watch",
      list: this.watch_list
    });
  };

  Watch.prototype.stop = function() {
    this.started = false;
    return this.runwindow.postMessage({
      name: "stop_watching"
    });
  };

  Watch.prototype.addWatch = function(w) {
    console.info("adding watch: " + w);
    this.watch_list.push(w);
    this.watch_list_updated = true;
    return this.start();
  };

  Watch.prototype.removeWatch = function(w) {
    var index;
    console.info("removing watch: " + w);
    index = this.watch_list.indexOf(w);
    if (w.indexOf(".") > 0) {
      delete this.watch_lines[w];
    }
    if (index >= 0) {
      this.watch_list.splice(index, 1);
      return this.start();
    }
  };

  Watch.prototype.watchUpdate = function(msg) {
    var alive, data, e, key, ref, ref1, set_key, set_value, value;
    if (!this.started) {
      return;
    }
    data = msg.data;
    alive = {};
    for (set_key in data) {
      set_value = data[set_key];
      if (set_key !== "global") {
        if (this.watch_lines.hasOwnProperty(set_key)) {
          alive[set_key] = true;
          this.watch_lines[set_key].updateContents(set_value);
        }
      }
    }
    e = document.getElementById("debug-watch-content");
    ref = data.global;
    for (key in ref) {
      value = ref[key];
      if (this.watch_lines.hasOwnProperty(key)) {
        this.watch_lines[key].updateValue(value);
      } else {
        this.watch_lines[key] = new WatchLine(this, e, key, value);
      }
      alive[key] = true;
    }
    if (!this.watch_list_updated) {
      ref1 = this.watch_lines;
      for (key in ref1) {
        value = ref1[key];
        if (!alive[key]) {
          value.remove();
          e.removeChild(value.element);
          delete this.watch_lines[key];
        }
      }
    }
    this.watch_list_updated = false;
  };

  Watch.prototype.isFiltered = function(w) {
    var v;
    v = w.value;
    if (this["filtered_type_" + v.type]) {
      return true;
    }
    if ((this.text_filter != null) && this.text_filter.length > 0 && w.prefixed.indexOf(this.text_filter) < 0) {
      return true;
    }
    return false;
  };

  Watch.prototype.updateFilters = function() {
    var key, ref, results, value;
    ref = this.watch_lines;
    results = [];
    for (key in ref) {
      value = ref[key];
      results.push(value.filterUpdate());
    }
    return results;
  };

  Watch.prototype.runtimeEvent = function(event) {
    switch (event) {
      case "play":
      case "reload":
        return this.reset();
      case "started":
        if (!this.app.appui.debug_splitbar.closed2) {
          this.reset();
          return this.start();
        }
        break;
      case "exit":
        this.started = false;
        return this.reset();
    }
  };

  return Watch;

})();

this.WatchLine = (function() {
  function WatchLine(watch, parent_element, variable, value1, prefix) {
    this.watch = watch;
    this.parent_element = parent_element;
    this.variable = variable;
    this.value = value1;
    this.prefix = prefix;
    this.prefixed = this.prefix != null ? this.prefix + "." + this.variable : this.variable;
    this.element = document.createElement("div");
    this.element.classList.add("watch-line");
    this.element.innerHTML = "<div class=\"watch-line-name\"><i class=\"fa\"></i> " + this.variable + "</div>\n<div class=\"watch-line-value\">" + (this.textValue()) + "</div>";
    this.element.classList.add(this.value.type);
    this.parent_element.appendChild(this.element);
    this.element.querySelector(".watch-line-value").addEventListener("click", (function(_this) {
      return function() {
        return _this.editValue();
      };
    })(this));
    this.element.querySelector("i").addEventListener("click", (function(_this) {
      return function() {
        var ref;
        if ((ref = _this.value.type) === "object" || ref === "list") {
          if (!_this.open) {
            _this.open = true;
            _this.watch.addWatch(_this.prefixed);
            _this.watch.watch_lines[_this.prefixed] = _this;
            _this.element.classList.add("open");
            if (_this.content != null) {
              return _this.content.style.display = "block";
            }
          } else {
            _this.open = false;
            _this.watch.removeWatch(_this.prefixed);
            _this.element.classList.remove("open");
            _this.watch_lines = {};
            if (_this.content != null) {
              _this.element.removeChild(_this.content);
              return _this.content = null;
            }
          }
        }
      };
    })(this));
    this.hidden = false;
    this.filterUpdate();
    this.watch_lines = {};
  }

  WatchLine.prototype.remove = function() {
    this.watch.removeWatch(this.prefixed);
    this.watch_lines = {};
    if (this.content != null) {
      this.element.removeChild(this.content);
      this.content = null;
    }
    this.element.classList.remove("open");
    return this.open = false;
  };

  WatchLine.prototype.textValue = function() {
    switch (this.value.type) {
      case "string":
        return '"' + this.value.value + '"';
      case "function":
        return "function()";
      case "list":
        return "[list:" + this.value.length + "]";
      case "object":
        return this.value.value || "object .. end";
      default:
        return this.value.value;
    }
  };

  WatchLine.prototype.updateValue = function(value) {
    var ref;
    if (value.type !== this.value.type) {
      this.element.classList.remove(this.value.type);
      this.element.classList.add(value.type);
      this.value.type = value.type;
      if ((this.content != null) && ((ref = this.value.type) !== "object" && ref !== "list")) {
        this.remove();
      }
    }
    if (value.value !== this.value.value || value.length !== this.value.length) {
      this.value.value = value.value;
      this.value.length = value.length;
      return this.element.querySelector(".watch-line-value").innerText = this.textValue();
    }
  };

  WatchLine.prototype.updateContents = function(data) {
    var active, key, ref, results, value;
    if (!this.open) {
      return;
    }
    if (!this.content) {
      this.content = document.createElement("div");
      this.content.classList.add("watch-line-content");
      this.element.appendChild(this.content);
    }
    active = {};
    for (key in data) {
      value = data[key];
      if (this.watch_lines.hasOwnProperty(key)) {
        this.watch_lines[key].updateValue(value);
      } else {
        this.watch_lines[key] = new WatchLine(this.watch, this.content, key, value, this.prefixed);
      }
      active[key] = true;
    }
    ref = this.watch_lines;
    results = [];
    for (key in ref) {
      value = ref[key];
      if (!active[key]) {
        delete this.watch_lines[key];
        value.remove();
        if (this.content != null) {
          results.push(this.content.removeChild(value.element));
        } else {
          results.push(void 0);
        }
      } else {
        results.push(void 0);
      }
    }
    return results;
  };

  WatchLine.prototype.filterUpdate = function() {
    var key, ref, results, value;
    if (this.hidden !== this.watch.isFiltered(this)) {
      this.hidden = !this.hidden;
      this.element.style.display = this.hidden ? "none" : "block";
    }
    ref = this.watch_lines;
    results = [];
    for (key in ref) {
      value = ref[key];
      results.push(value.filterUpdate());
    }
    return results;
  };

  WatchLine.prototype.editValue = function() {
    var input;
    if (this.value.type === "number" || this.value.type === "string") {
      input = document.createElement("input");
      input.type = "text";
      input.value = this.value.value;
      this.element.appendChild(input);
      input.addEventListener("blur", (function(_this) {
        return function() {
          return _this.element.removeChild(input);
        };
      })(this));
      input.addEventListener("keydown", (function(_this) {
        return function(event) {
          var err;
          if (event.key === "Enter") {
            event.preventDefault();
            if (input.value !== _this.value.value) {
              try {
                if (_this.value.type === "number") {
                  if (isFinite(parseFloat(input.value))) {
                    _this.watch.app.runwindow.runCommand(_this.prefixed + " = " + input.value, function() {});
                  }
                } else if (_this.value.type === "string") {
                  _this.watch.app.runwindow.runCommand(_this.prefixed + " = \"" + input.value + "\" ", function() {});
                }
              } catch (error) {
                err = error;
                console.error(err);
              }
            }
            return input.blur();
          }
        };
      })(this));
      return input.focus();
    }
  };

  return WatchLine;

})();

this.Player = class Player {
  constructor(listener) {
    this.listener = listener;
    //src = document.getElementById("code").innerText
    this.source_count = 0;
    this.sources = {};
    this.resources = resources;
    this.request_id = 1;
    this.pending_requests = {};
    this.sources.main = server_code;
    // player = new Player() must return before the server is started
    // to ensure global.player is defined
    setTimeout((() => {
      return this.start();
    }), 1);
  }

  start() {
    this.runtime = new Runtime("", this.sources, resources, this);
    this.terminal = new Terminal(this);
    this.terminal.start();
    this.runtime.start();
    return setInterval((() => {
      return this.runtime.clock();
    }), 16);
  }

  runCommand(cmd) {}

  reportError(err) {
    return this.terminal.error(err);
  }

  log(text) {
    return this.terminal.echo(text);
  }

  exit() {}

  call(name, args) {
    if ((this.runtime != null) && (this.runtime.vm != null)) {
      return this.runtime.vm.call(name, args);
    }
  }

  setGlobal(name, value) {
    if ((this.runtime != null) && (this.runtime.vm != null)) {
      return this.runtime.vm.context.global[name] = value;
    }
  }

  exec(command, callback) {
    if (this.runtime != null) {
      return this.runtime.runCommand(command, callback);
    }
  }

  postMessage(message) {
    return console.info(JSON.stringify(message));
  }

};

this.Terminal = class Terminal {
  constructor(runwindow) {
    this.runwindow = runwindow;
  }

  start() {}

  validateLine(v) {}

  setTrailingCaret() {}

  echo(text, scroll = false, classname) {
    return console.info(text);
  }

  error(text, scroll = false) {
    return console.error(text);
  }

  clear() {}

};



for (const prop in this) {
  global[prop] = this[prop] ;
}

var fs = require("fs") ;
fs.readFile("./config.json",(err,data)=> {
  global.server_port = 3000 ;
  if (! err) {
    console.info("config.json loaded") ;
    try {
      var config = JSON.parse(data) ;
      global.server_port = config.port || 3000 ;
    } catch (err) {
      console.info("could not parse config file") ;
    }
  } else {
    console.info("could not read config file") ;
  }
  console.info( "starting with port set to: "+global.server_port ) ;
  auth.init(function(err) {
    if (err) {
      console.error("Auth DB Fehler - starte trotzdem:", err.message) ;
    }
    start() ;
  }) ;
}) ;
