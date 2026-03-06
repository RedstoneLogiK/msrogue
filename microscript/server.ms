serverInit = function()
  print("serverInit laeuft...")
  server = new Server()
  players = object end
  coins = []
  broadcast_timer = 0
  coin_timer = 0
  coin_id_counter = 0
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

broadcast_all = function()
  local list = []
  local c = 0
  for c in server.active_connections
    local p = players[c.id]
    if p != 0 and p != null then
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

serverUpdate = function()
  local conn = 0
  for conn in server.new_connections
    print("Neue Verbindung: " + conn.id)
    conn.send(object mtype="id" id=conn.id end)
    players[conn.id] = object
      name = ""
      x = 0
      y = 0
      score = 0
      logged_in = 0
    end
  end

  for conn in server.closed_connections
    print("Getrennt: " + conn.id)
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
          players[pid].name = result.username
          players[pid].logged_in = 1
          print("Register: " + result.username)
          message.connection.send(object mtype="auth_ok" token=result.token name=result.username end)
          broadcast_all()
        else
          message.connection.send(object mtype="auth_fail" error=result.error end)
        end

      elsif message.data.mtype == "login" then
        local result = auth_login(message.data.name, message.data.password)
        if result.success then
          // Pruefen ob Name bereits online ist
          local already_online = 0
          local cc = 0
          for cc in server.active_connections
            if players[cc.id] != 0 and players[cc.id] != null then
              if players[cc.id].name == result.username and cc.id != pid then
                already_online = 1
              end
            end
          end
          if already_online == 1 then
            message.connection.send(object mtype="auth_fail" error="Bereits eingeloggt" end)
          else
            players[pid].name = result.username
            players[pid].logged_in = 1
            print("Login: " + result.username)
            message.connection.send(object mtype="auth_ok" token=result.token name=result.username end)
            broadcast_all()
          end
        else
          message.connection.send(object mtype="auth_fail" error=result.error end)
        end

      elsif message.data.mtype == "token_login" then
        local result = auth_validate(message.data.token)
        if result.success then
          local already_online = 0
          local cc = 0
          for cc in server.active_connections
            if players[cc.id] != 0 and players[cc.id] != null then
              if players[cc.id].name == result.username and cc.id != pid then
                already_online = 1
              end
            end
          end
          if already_online == 1 then
            message.connection.send(object mtype="auth_fail" error="Bereits eingeloggt" end)
          else
            players[pid].name = result.username
            players[pid].logged_in = 1
            print("Token-Login: " + result.username)
            message.connection.send(object mtype="auth_ok" token=message.data.token name=result.username end)
            broadcast_all()
          end
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
          // Server berechnet value_multiplier nicht mehr vom Client
          local vm = message.data.value_multiplier
          if vm == 0 or vm == null then vm = 1 end
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
          local bc = 0
          for bc in server.active_connections
            bc.send(object mtype="bomb" coin_id=coin_id bx=bomb_bx bomb_by=bomb_by victim=victim end)
          end
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

  // Broadcast alle 2 Frames
  broadcast_timer = broadcast_timer + 1
  if broadcast_timer >= 2 then
    broadcast_timer = 0
    broadcast_all()
  end
end
