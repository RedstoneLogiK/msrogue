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
