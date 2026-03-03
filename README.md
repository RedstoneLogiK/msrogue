# 🪙 Rogue Coins

A multiplayer coin-collecting game built with [microStudio](https://microstudio.dev).  
Dodge bombs, collect coins, upgrade your character, and compete with other players in real time!

---

## 🎮 Gameplay

Control your rogue character and catch falling coins while avoiding bombs.  
Earn gold to unlock upgrades in the shop and survive as long as possible.

### Item Types

| Item | Value | Notes |
|------|-------|-------|
| 🥉 Bronze Coin | 1× | Common, slow |
| 🥈 Silver Coin | 3× | Uncommon |
| 🥇 Gold Coin | 10× | Rare, fast |
| 💎 Diamond Coin | 100× | Very rare |
| 💣 Bomb | — | Costs 1 life on hit |

> All coin values scale with your **Value Multiplier** upgrade.

---

## 🕹️ Controls

| Key | Action |
|-----|--------|
| `W` / `↑` | Move up |
| `S` / `↓` | Move down |
| `A` / `←` | Move left |
| `D` / `→` | Move right |
| `B` | Open / close Shop |
| `ESC` | Pause / unpause |
| `G` *(hold)* | Activate Godmode (if purchased) |
| `ENTER` | Confirm login |
| `BACKSPACE` | Delete character in login |

---

## 🏪 Shop

Open the shop with `B`. Spend your gold on upgrades:

| Slot | Upgrade | Effect | Starting Cost |
|------|---------|--------|---------------|
| `1` | **Speed** | +0.5 move speed | 10 |
| `2` | **Value ×** | +1 coin value multiplier | 15 |
| `3` | **Heal** | +1 life (max 3) | 200 |
| `4` | **Godmode** | +10s godmode duration | 2,000 |
| `5` | **Totem** | Revive once on death | 500,000 |

Costs increase with each purchase. Press `R` in the shop to reset your save.

---

## 🌐 Multiplayer

On startup you'll be asked to enter a username (A–Z, 0–9, max 14 characters).  
After logging in, your position is synced to a server every 5 frames.  
Other online players appear on the game field and are listed in the **Online** panel on the right.

---

## 💾 Save System

Progress is automatically saved to local storage after every significant event (coin collection, upgrade purchase, totem use). On restart, your score, upgrades, lives, and godmode timer are restored.

---

## 🛠️ Technical Details

- **Engine:** [microStudio](https://microstudio.dev)
- **Language:** microScript
- **Multiplayer:** Custom `ServerConnection` via microStudio's network API
- **Persistence:** `storage.get` / `storage.set`

---

## 📄 License

© 2026 Simon Bleher — Licensed under [GNU GPLv3](https://www.gnu.org/licenses/gpl-3.0.html)
