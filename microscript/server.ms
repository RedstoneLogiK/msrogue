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

      if message.data.mtype == "login" then
        players[message.connection.id].name = message.data.name
        print("Login: " + message.data.name)
        broadcast_all()

      elsif message.data.mtype == "pos" then
        if players[message.connection.id] != 0 then
          players[message.connection.id].x = message.data.x
          players[message.connection.id].y = message.data.y
        end

      elsif message.data.mtype == "collect" then
        local coin_id = message.data.coin_id
        local vm = message.data.value_multiplier
        if vm == 0 or vm == null then vm = 1 end
        local i = 0
        for i = 0 to coins.length - 1
          if coins[i] != 0 and coins[i].id == coin_id then
            local val = coins[i].value * vm
            if players[message.connection.id] != 0 then
              players[message.connection.id].score = players[message.connection.id].score + val
            end
            coins.removeAt(i)
            broadcast_all()
            i = coins.length
          end
        end

      elsif message.data.mtype == "bomb_hit" then
        local coin_id = message.data.coin_id
        local bomb_bx = message.data.bx
        local bomb_by = message.data.bomb_by
        local victim = message.data.victim
        // Münze entfernen
        local i = 0
        for i = 0 to coins.length - 1
          if coins[i] != 0 and coins[i].id == coin_id then
            coins.removeAt(i)
            i = coins.length
          end
        end
        // Explosion an ALLE senden
        local bc = 0
        for bc in server.active_connections
          bc.send(object mtype="bomb" coin_id=coin_id bx=bomb_bx bomb_by=bomb_by victim=victim end)
        end
        broadcast_all()

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

  // Spawn-Rate abhängig von Spieleranzahl (1.75x bei 2 Spielern etc.)
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
