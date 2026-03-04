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

// Leaderboard als flache Arrays – vermeidet Typ-Probleme
lb_names = []
lb_scores = []

save_game = function()
  local data = object end
  data.score = score
  data.speed_level = speed_level
  data.value_multiplier = value_multiplier
  data.rogue_speed = rogue.speed
  data.cost_speed = cost_speed
  data.cost_value = cost_value
  data.lives = lives
  data.godmode = godmode
  data.godmode_timer = godmode_timer
  data.totems = totems
  storage.set("rogue_save_data", data)
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

init = function()
  connection = new ServerConnection("wss://game.redstonelogik.de")
  myID = "none"
  rogue.x = 0
  rogue.y = 0
  coins = []
  explosions = []
  username = ""
  online_players = []
  other_players = []
  lb_names = []
  lb_scores = []
  pos_timer = 0

  local data = storage.get("rogue_save_data")
  if data then
    score = data.score
    speed_level = data.speed_level
    value_multiplier = data.value_multiplier
    rogue.speed = data.rogue_speed
    cost_speed = data.cost_speed
    cost_value = data.cost_value
    if data.lives > 0 then lives = data.lives else lives = 3 end
    if data.godmode == 1 then
      godmode = 1
      godmode_timer = data.godmode_timer
    else
      godmode = 0
      godmode_timer = 0
    end
    if data.totems != 0 then totems = data.totems else totems = 0 end
    print("Spielstand geladen")
  else
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
    print("Neues Spiel")
  end

  game_state = "login"
end

update = function()
  local message = 0
  for message in connection.messages
    if message.mtype == "id" then
      myID = message.id

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

      // Leaderboard Arrays befüllen
      lb_names = []
      lb_scores = []
      for p in message.players
        lb_names.push(p.name)
        lb_scores.push(p.score)
      end

      // Bubble sort auf flachen Arrays
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

      coins = message.coins

    elsif message.mtype == "bomb" then
      create_explosion(message.bx, message.bomb_by)
      audio.playSound("explosion_sound")
      if message.victim == username then
        lives = lives - 1
        if lives <= 0 then
          if totems > 0 then
            totems = totems - 1
            lives = 3
            audio.playSound("coin")
            save_game()
          else
            storage.set("rogue_save_data", 0)
            game_state = "gameover"
          end
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
    storage.set("rogue_save_data", 0)
    init()
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
  local letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  for i = 0 to letters.length - 1
    local ch = letters[i]
    if keyboard.press[ch] and username.length < 14 then
      username = username + ch
    end
  end

  local nums = "0123456789"
  for i = 0 to nums.length - 1
    local n = nums[i]
    if keyboard.press[n] and username.length < 14 then
      username = username + n
    end
  end

  if keyboard.press.BACKSPACE and username.length > 0 then
    username = username.slice(0, username.length - 1)
  end

  if keyboard.press.ENTER and username.length > 0 then
    connection.send(object mtype="login" name=username end)
    game_state = "play"
  end
end

update_gameover = function()
  if keyboard.press.SPACE or keyboard.press.ENTER then
    storage.set("rogue_save_data", 0)
    init()
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
    godmode_timer = godmode_timer - 1
    if godmode_timer <= 0 then
      godmode = 0
      godmode_timer = 0
      print("Godmode abgelaufen!")
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

      if c.item_type == "bomb" and dist < 45 then
        connection.send(object mtype="bomb_hit" coin_id=c.id bx=c.x bomb_by=c.y victim=username end)
        coins.removeAt(i)
        i = i - 1

      elsif c.item_type == "coin" and dist < 30 then
        connection.send(object mtype="collect" coin_id=c.id value_multiplier=value_multiplier end)
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

  timer = timer + 1
end

update_shop = function()
  if keyboard.press["1"] then
    if score >= cost_speed then
      score = score - cost_speed
      rogue.speed = rogue.speed + 0.5
      speed_level = speed_level + 1
      cost_speed = floor(cost_speed * 1.5)
      save_game()
    end
  end

  if keyboard.press["2"] then
    if score >= cost_value then
      score = score - cost_value
      value_multiplier = value_multiplier + 1
      cost_value = floor(cost_value * 1.8)
      save_game()
    end
  end

  if keyboard.press["3"] then
    if score >= cost_heal and lives < 3 then
      score = score - cost_heal
      lives = lives + 1
      save_game()
    end
  end

  if keyboard.press["4"] then
    if score >= cost_godmode then
      score = score - cost_godmode
      godmode = 1
      godmode_timer = godmode_timer + 600
      save_game()
    end
  end

  if keyboard.press["5"] then
    if score >= cost_totem then
      score = score - cost_totem
      totems = totems + 1
      save_game()
    end
  end
end

draw = function()
  screen.clear("#670000")

  if game_state == "login" then
    draw_login()
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

draw_login = function()
  screen.fillRect(0, 0, screen.width, screen.height, "rgba(0,0,0,0.92)")
  screen.drawText("ROGUE COINS", 0, 60, 35, "#FFD700")
  screen.drawText("Benutzername eingeben:", 0, 20, 16, "white")

  screen.fillRect(0, -5, 180, 28, "#222")
  screen.drawRect(0, -5, 180, 28, "#FFD700")

  local display = username
  if floor(timer / 20) % 2 == 0 then display = display + "_" end
  screen.drawText(display, 0, -5, 18, "#FFD700")

  screen.drawText("[ENTER] Beitreten", 0, -45, 13, "lime")
  screen.drawText("(max. 14 Zeichen, A-Z 0-9)", 0, -65, 10, "gray")
end

draw_pause = function()
  draw_game()
  screen.fillRect(0, 0, screen.width, screen.height, "rgba(0,0,0,0.6)")
  screen.drawText("PAUSE", 0, 20, 50, "white")
  screen.drawText("Drücke [ESC] um weiterzuspielen", 0, -30, 15, "white")
end

draw_gameover = function()
  draw_game()
  screen.fillRect(0, 0, screen.width, screen.height, "rgba(0,0,0,0.8)")
  screen.drawText("GAME OVER", 0, 40, 50, "red")
  screen.drawText("Endgültiger Score: " + score, 0, -10, 20, "white")
  screen.drawText("Drücke [SPACE] für Neustart (Reset)", 0, -60, 15, "yellow")
end

draw_game = function()
  // Münzen zeichnen
  local c = 0
  for c in coins
    screen.drawSprite(c.im, c.x, c.y, c.w, c.h)
  end

  // Explosionen zeichnen
  local ex = 0
  for ex in explosions
    screen.drawSprite("effects/explosion", ex.x, ex.y, 64 * ex.scale, 64 * ex.scale)
  end

  // Andere Spieler zeichnen mit Interpolation + Animation
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

  // Eigenen Charakter zeichnen
  screen.drawSprite(rogue.im, rogue.x, rogue.y, rogue.w, rogue.h)
  screen.drawText(username, rogue.x, rogue.y + 22, 8, "lime")

  // Leben
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

  // Leaderboard rechts – direkt aus flachen Arrays
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

  screen.drawText("© 2026 Simon Bleher - GNU GPLv3", 145, 95, 4, "#FFD700")
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

  screen.drawText("Drücke [B] oder [ESC] zum Schließen", 0, -85, 12, "white")
  screen.drawText("[R] Reset Spielstand", 0, -100, 10, "red")
end
