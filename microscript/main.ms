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

// Settings
volume = 100
skin = 1
skin_names = []
skin_colors = []
settings_selection = 0

play_sound = function(name)
  audio.playSound(name, volume / 100, 1, 0, 0)
end

get_skin_suffix = function(s)
  if s == 2 then return "1" end
  if s == 3 then return "2" end
  return ""
end

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
  if msg.volume != null then volume = msg.volume end
  if msg.skin != null then skin = msg.skin end
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

  // Skin Setup
  skin_names = ["Classic", "Frost", "Blaze"]
  skin_colors = ["rgba(0,0,0,0)", "rgba(80,160,255,0.35)", "rgba(255,80,40,0.35)"]
  settings_selection = 0

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
            found.skin = p.skin
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
      play_sound("explosion_sound")
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
    elsif game_state == "settings" then
      game_state = "play"
    end
  end

  if keyboard.press.O then
    if game_state == "play" then
      settings_selection = 0
      game_state = "settings"
    elsif game_state == "settings" then
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
  elsif game_state == "settings" then
    update_settings()
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
    // Timer wird server-seitig runtergezaehlt, client zeigt nur an
    godmode_timer = godmode_timer - 1
    if godmode_timer <= 0 then
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

  local sfx = get_skin_suffix(skin)
  if moving then
    rogue.im = "rogue_" + rogue.dir + sfx
  else
    rogue.im = "rogue_" + rogue.dir + "_idle" + sfx
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
        play_sound("coin")
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

update_settings = function()
  // Hoch/Runter zum Navigieren (0=Volume, 1=Skin)
  if keyboard.press.W then
    settings_selection = 0
  end
  if keyboard.press.S then
    settings_selection = 1
  end

  if settings_selection == 0 then
    // Volume aendern
    if keyboard.press.A or keyboard.press.LEFT then
      volume = max(0, volume - 10)
      connection.send(object mtype="save_settings" volume=volume skin=skin end)
    end
    if keyboard.press.D or keyboard.press.RIGHT then
      volume = min(100, volume + 10)
      connection.send(object mtype="save_settings" volume=volume skin=skin end)
    end
  elsif settings_selection == 1 then
    // Skin aendern
    if keyboard.press.A or keyboard.press.LEFT then
      skin = skin - 1
      if skin < 1 then skin = 3 end
      connection.send(object mtype="save_settings" volume=volume skin=skin end)
    end
    if keyboard.press.D or keyboard.press.RIGHT then
      skin = skin + 1
      if skin > 3 then skin = 1 end
      connection.send(object mtype="save_settings" volume=volume skin=skin end)
    end
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
  elsif game_state == "settings" then
    draw_settings()
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

draw_settings = function()
  screen.fillRect(0, 0, screen.width, screen.height, "rgba(0,0,0,0.95)")
  screen.drawText("--- SETTINGS ---", 0, 80, 30, "#FFD700")

  // Volume
  local v_col = "#555"
  if settings_selection == 0 then v_col = "#FFD700" end
  screen.drawText("Lautstaerke", 0, 40, 16, v_col)
  // Volume Bar
  screen.fillRect(0, 22, 160, 14, "#333")
  screen.fillRect(-80 + (volume / 100) * 80, 22, (volume / 100) * 160, 14, v_col)
  screen.drawRect(0, 22, 160, 14, v_col)
  screen.drawText(volume + "%", 0, 22, 12, "white")

  // Skin
  local s_col = "#555"
  if settings_selection == 1 then s_col = "#FFD700" end
  screen.drawText("Skin", 0, -10, 16, s_col)

  // Skin Vorschau
  local sk_name = skin_names[skin - 1]
  screen.drawText("< " + sk_name + " >", 0, -30, 14, s_col)

  // Vorschau-Charakter
  screen.drawSprite("rogue_down_idle" + get_skin_suffix(skin), 0, -55, 32, 32)

  screen.drawText("[W/S] Auswahl  [A/D] Aendern", 0, -85, 10, "gray")
  screen.drawText("[O] oder [ESC] Zurueck", 0, -96, 10, "gray")
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
    local op_sfx = get_skin_suffix(op.skin)
    local op_dir = "down"
    local op_moving = false
    if abs(dx) > 0.3 or abs(dy) > 0.3 then
      op_moving = true
      if abs(dx) > abs(dy) then
        if dx > 0 then op_dir = "right" else op_dir = "left" end
      else
        if dy > 0 then op_dir = "up" else op_dir = "down" end
      end
      op.last_move_dir = op_dir
    else
      if op.last_move_dir then
        op_dir = op.last_move_dir
      end
    end
    local op_im = "rogue_" + op_dir + op_sfx
    if not op_moving then
      op_im = "rogue_" + op_dir + "_idle" + op_sfx
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
  screen.drawText("[B] SHOP / [O] SETTINGS / [ESC] PAUSE", 0, -screen.height/2 + 20, 12, "#FFD700")

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
