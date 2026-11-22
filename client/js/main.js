import { Client } from "@colyseus/sdk";
import { CLASH_ZERO_CONFIG } from "./gameConfig.js";

const arena = document.querySelector("#arena");
const player = document.querySelector("#player");
const target = document.querySelector("#target");
const dashButton = document.querySelector('[data-action="dash"]');
const targetHpValue = document.querySelector("#target-hp-value");
const targetHealthFill = document.querySelector("#target-health-fill");
const combatStatus = document.querySelector("#combat-status");
const playerHpValue = document.querySelector("#player-hp-value");
const playerHealthFill = document.querySelector("#player-health-fill");
const matchResult = document.querySelector("#match-result");
const matchResultKicker = document.querySelector("#match-result-kicker");
const matchResultTitle = document.querySelector("#match-result-title");
const matchResultMessage = document.querySelector("#match-result-message");
const retryMatchButton = document.querySelector("#retry-match");
const returnToLobbyButton = document.querySelector("#return-to-lobby");
const homeHeader = document.querySelector("#home-header");
const modeScreen = document.querySelector("#mode-screen");
const trainingScreen = document.querySelector("#training-screen");
const onlineScreen = document.querySelector("#online-screen");
const modePicker = document.querySelector("#mode-picker");
const openModePickerButton = document.querySelector("#open-mode-picker");
const closeModePickerButton = document.querySelector("#close-mode-picker");
const chooseTrainingButton = document.querySelector("#choose-training");
const chooseOnlineButton = document.querySelector("#choose-online");
const prototypeSlotButton = document.querySelector("#prototype-slot");
const backFromTrainingButton = document.querySelector("#back-from-training");
const backFromOnlineButton = document.querySelector("#back-from-online");
const createRoomButton = document.querySelector("#create-room-button");
const joinRoomForm = document.querySelector("#join-room-form");
const roomCodeInput = document.querySelector("#room-code-input");
const roomInfo = document.querySelector("#room-info");
const roomCodeOutput = document.querySelector("#room-code-output");
const roomPlayerStatus = document.querySelector("#room-player-status");
const connectionBadge = document.querySelector("#connection-badge");
const onlineMessage = document.querySelector("#online-message");
const leaveRoomButton = document.querySelector("#leave-room-button");
const copyRoomCodeButton = document.querySelector("#copy-room-code-button");
const joinRoomButton = joinRoomForm.querySelector("button[type='submit']");
const localSeatStatus = document.querySelector("#local-seat-status");
const opponentSeatStatus = document.querySelector("#opponent-seat-status");
const statHp = document.querySelector("#stat-hp");
const statMove = document.querySelector("#stat-move");
const statAttack = document.querySelector("#stat-attack");
const statDash = document.querySelector("#stat-dash");
const GAME_CONFIG = CLASH_ZERO_CONFIG;
const PLAYER_RULES = GAME_CONFIG.characterProfiles[GAME_CONFIG.selectedCharacterId];
const TARGET_RULES = GAME_CONFIG.trainingTarget;
const GAME_SERVER_URL = import.meta.env.VITE_GAME_SERVER_URL || "http://localhost:2567";
const networkClient = new Client(GAME_SERVER_URL);
const keyboardDirections = new Set();
const touchDirections = new Map();
const playerSize = 42;
const targetSize = 42;
const targetMaxHp = TARGET_RULES.maxHp;
const playerMaxHp = PLAYER_RULES.maxHp;
const perfectDodgeWindowMs = PLAYER_RULES.dodge.perfectWindowMs;
const invulnerabilityDurationMs = PLAYER_RULES.dodge.invulnerabilityMs;

let x = 0;
let y = 0;
let targetX = 0;
let targetY = 0;
let targetHp = targetMaxHp;
let playerHp = playerMaxHp;
let facingX = 0;
let facingY = -1;
let dashDirectionX = 0;
let dashDirectionY = -1;
let dashTimeRemaining = 0;
let invulnerabilityRemaining = 0;
let previousFrame = 0;
let lastAttackAt = -Infinity;
let lastDashAt = -Infinity;
let combatStatusTimer;
let targetAttackWindupRemaining = 0;
let targetAttackCooldownRemaining = 0;
let perfectDodgeArmed = false;
let matchOver = false;
let activeRoom = null;

const keyDirections = new Map([
	["w", "up"], ["arrowup", "up"],
	["a", "left"], ["arrowleft", "left"],
	["s", "down"], ["arrowdown", "down"],
	["d", "right"], ["arrowright", "right"],
]);

function renderCharacterStats() {
	statHp.textContent = String(PLAYER_RULES.maxHp);
	statMove.textContent = String(PLAYER_RULES.moveSpeed);
	statAttack.textContent = String(PLAYER_RULES.attack.damage);
	statDash.textContent = String(PLAYER_RULES.dash.speed);
}

function showScreen(screenName) {
	const isHome = screenName === "home";
	modePicker.hidden = true;
	openModePickerButton.setAttribute("aria-expanded", "false");
	homeHeader.hidden = !isHome;
	modeScreen.hidden = !isHome;
	trainingScreen.hidden = screenName !== "training";
	onlineScreen.hidden = screenName !== "online";

	if (screenName === "training") {
		requestAnimationFrame(() => {
			startNewMatch();
		});
	}
}

openModePickerButton.addEventListener("click", () => {
	modePicker.hidden = !modePicker.hidden;
	openModePickerButton.setAttribute("aria-expanded", String(!modePicker.hidden));
});
closeModePickerButton.addEventListener("click", () => {
	modePicker.hidden = true;
	openModePickerButton.setAttribute("aria-expanded", "false");
});
window.addEventListener("keydown", (event) => {
	if (event.key === "Escape" && !modePicker.hidden) {
		modePicker.hidden = true;
		openModePickerButton.setAttribute("aria-expanded", "false");
		openModePickerButton.focus();
	}
});
chooseTrainingButton.addEventListener("click", () => showScreen("training"));
chooseOnlineButton.addEventListener("click", () => showScreen("online"));
prototypeSlotButton.addEventListener("click", () => {
	prototypeSlotButton.setAttribute("aria-pressed", "true");
	prototypeSlotButton.classList.add("roster-slot-active");
});
backFromTrainingButton.addEventListener("click", () => showScreen("home"));
retryMatchButton.addEventListener("click", startNewMatch);
returnToLobbyButton.addEventListener("click", () => showScreen("home"));
backFromOnlineButton.addEventListener("click", async () => {
	if (activeRoom) await activeRoom.leave();
	showScreen("home");
});

function setRoomActionsDisabled(disabled) {
	createRoomButton.disabled = disabled;
	joinRoomButton.disabled = disabled;
}

function updateRoomStatus(state) {
	const players = state?.players;
	const playerCount = players?.size ?? 0;
	const status = state?.status ?? "waiting";
	localSeatStatus.textContent = playerCount > 0 ? "LINKED" : "LOCAL";
	opponentSeatStatus.textContent = status === "ready" ? "READY" : "WAITING";
	roomPlayerStatus.textContent = status === "ready"
		? `対戦相手が参加したよ · ${playerCount}/2`
		: playerCount > 0
			? `相手を待っています · ${playerCount}/2`
			: "ルームを準備中…";
}

function showConnectedRoom(room) {
	activeRoom = room;
	roomInfo.hidden = false;
	roomCodeOutput.textContent = room.roomId;
	roomCodeInput.value = room.roomId;
	connectionBadge.textContent = "CONNECTED";
	connectionBadge.classList.add("connected");
	setRoomActionsDisabled(true);
	updateRoomStatus(room.state);
	onlineMessage.textContent = "このコードを友達に送って、同じルームに参加してもらおう。";

	room.onStateChange(updateRoomStatus);
	room.onLeave(() => {
		if (activeRoom !== room) return;
		activeRoom = null;
		roomInfo.hidden = true;
		connectionBadge.textContent = "OFFLINE";
		connectionBadge.classList.remove("connected");
		localSeatStatus.textContent = "LOCAL";
		opponentSeatStatus.textContent = "WAITING";
		setRoomActionsDisabled(false);
		onlineMessage.textContent = "ルームから退出したよ。";
	});
}

async function createOnlineRoom() {
	if (activeRoom) return;
	setRoomActionsDisabled(true);
	onlineMessage.textContent = "サーバーに接続中…";

	try {
		const room = await networkClient.create("clash_zero");
		showConnectedRoom(room);
	} catch (error) {
		console.error("Could not create a room:", error);
		onlineMessage.textContent = "接続できなかったよ。サーバーが起動しているか確認してね。";
		setRoomActionsDisabled(false);
	}
}

async function joinOnlineRoom(roomId) {
	if (activeRoom) return;
	setRoomActionsDisabled(true);
	onlineMessage.textContent = "ルームを探しているよ…";

	try {
		const room = await networkClient.joinById(roomId);
		showConnectedRoom(room);
	} catch (error) {
		console.error("Could not join the room:", error);
		onlineMessage.textContent = "参加できなかったよ。コードが正しいか、ルームが満員でないか確認してね。";
		setRoomActionsDisabled(false);
	}
}

createRoomButton.addEventListener("click", createOnlineRoom);
joinRoomForm.addEventListener("submit", (event) => {
	event.preventDefault();
	const roomId = roomCodeInput.value.trim();
	if (roomId) joinOnlineRoom(roomId);
});
leaveRoomButton.addEventListener("click", async () => {
	if (activeRoom) await activeRoom.leave();
});
copyRoomCodeButton.addEventListener("click", async () => {
	try {
		await navigator.clipboard.writeText(roomCodeOutput.textContent);
		onlineMessage.textContent = "ルームコードをコピーしたよ。";
	} catch {
		roomCodeInput.focus();
		roomCodeInput.select();
		onlineMessage.textContent = "コードを選択したよ。コピーして友達に送ってね。";
	}
});

function placePlayer() {
	const maxX = arena.clientWidth - playerSize;
	const maxY = arena.clientHeight - playerSize;

	x = Math.max(0, Math.min(x, maxX));
	y = Math.max(0, Math.min(y, maxY));
	player.style.transform = `translate3d(${x}px, ${y}px, 0)`;
}

function placeTarget() {
	targetX = arena.clientWidth * 0.76 - targetSize / 2;
	targetY = (arena.clientHeight - targetSize) / 2;
	target.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
}

function updateTargetHp() {
	targetHpValue.textContent = String(targetHp);
	targetHealthFill.style.width = `${(targetHp / targetMaxHp) * 100}%`;
	showCombatStatus(targetHp > 0 ? `SPARRING AI · ${targetHp} HP` : "SPARRING AI DOWN");
}

function updatePlayerHp() {
	playerHpValue.textContent = `${playerHp} HP`;
	playerHealthFill.style.width = `${(playerHp / playerMaxHp) * 100}%`;
}

function showCombatStatus(message) {
	window.clearTimeout(combatStatusTimer);
	combatStatus.textContent = message;
	if (targetHp > 0 && playerHp > 0 && !matchOver) {
		combatStatusTimer = window.setTimeout(() => {
			combatStatus.textContent = `SPARRING AI · ${targetHp} HP`;
		}, 1100);
	}
}

function startNewMatch() {
	matchOver = false;
	matchResult.hidden = true;
	playerHp = playerMaxHp;
	targetHp = targetMaxHp;
	facingX = 1;
	facingY = 0;
	dashDirectionX = 1;
	dashDirectionY = 0;
	dashTimeRemaining = 0;
	invulnerabilityRemaining = 0;
	targetAttackWindupRemaining = 0;
	targetAttackCooldownRemaining = 700;
	perfectDodgeArmed = false;
	lastAttackAt = -Infinity;
	lastDashAt = -Infinity;
	keyboardDirections.clear();
	touchDirections.clear();
	player.classList.remove("attacking", "hurt", "dashing", "invulnerable", "perfect-dodge", "defeated");
	target.classList.remove("charging", "hit", "defeated");
	dashButton.disabled = false;
	window.clearTimeout(combatStatusTimer);
	centerPlayer();
	updateTargetHp();
	updatePlayerHp();
	placeTarget();
	player.style.setProperty("--facing-angle", "0deg");
	showCombatStatus("SPARRING AI · ENGAGE");
}

function endMatch(result) {
	if (matchOver) return;
	matchOver = true;
	keyboardDirections.clear();
	touchDirections.clear();
	player.classList.remove("attacking", "dashing", "charging");
	target.classList.remove("charging");
	matchResult.hidden = false;
	matchResultKicker.textContent = result === "win" ? "SPARRING AI DEFEATED" : "OPERATOR DOWN";
	matchResultTitle.textContent = result === "win" ? "YOU WIN" : "YOU LOSE";
	matchResultMessage.textContent = result === "win"
		? "コジュがAIを撃破した！"
		: "コジュが倒された。もう一度挑戦しよう。";
	showCombatStatus(result === "win" ? "AI DEFEATED" : "KOJU DOWN");
}

function handleKeyDown(event) {
	if (playerHp === 0 || matchOver) return;

	if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
		event.preventDefault();
		if (!event.repeat) dash();
		return;
	}

	if (event.code === "Space" || event.key.toLowerCase() === "j") {
		event.preventDefault();
		if (!event.repeat) attack();
		return;
	}

	const direction = keyDirections.get(event.key.toLowerCase());
	if (!direction) return;

	event.preventDefault();
	keyboardDirections.add(direction);
}

function handleKeyUp(event) {
	const direction = keyDirections.get(event.key.toLowerCase());
	if (direction) keyboardDirections.delete(direction);
}

function isDirectionPressed(direction) {
	return keyboardDirections.has(direction) || [...touchDirections.values()].includes(direction);
}

function attack() {
	if (playerHp === 0 || matchOver) return;
	const now = performance.now();
	if (now - lastAttackAt < PLAYER_RULES.attack.cooldownMs) return;

	lastAttackAt = now;
	player.classList.remove("attacking");
	void player.offsetWidth;
	player.classList.add("attacking");
	damageTargetIfHit();
}

function getMovementDirection() {
	let directionX = 0;
	let directionY = 0;

	if (isDirectionPressed("left")) directionX -= 1;
	if (isDirectionPressed("right")) directionX += 1;
	if (isDirectionPressed("up")) directionY -= 1;
	if (isDirectionPressed("down")) directionY += 1;

	const length = Math.hypot(directionX, directionY);
	return length === 0
		? { x: 0, y: 0 }
		: { x: directionX / length, y: directionY / length };
}

function dash() {
	if (playerHp === 0 || matchOver) return;
	const now = performance.now();
	if (now - lastDashAt < PLAYER_RULES.dash.cooldownMs || dashTimeRemaining > 0) return;

	lastDashAt = now;
	dashTimeRemaining = PLAYER_RULES.dash.durationMs / 1000;
	const direction = getMovementDirection();
	if (direction.x !== 0 || direction.y !== 0) {
		facingX = direction.x;
		facingY = direction.y;
	}

	dashDirectionX = facingX;
	dashDirectionY = facingY;
	player.style.setProperty("--trail-x", `${-dashDirectionX * 28}px`);
	player.style.setProperty("--trail-y", `${-dashDirectionY * 28}px`);
	player.style.setProperty("--facing-angle", `${Math.atan2(facingY, facingX) * (180 / Math.PI)}deg`);
	player.classList.add("dashing");

	if (isPerfectDodgeWindow()) {
		perfectDodgeArmed = true;
		invulnerabilityRemaining = invulnerabilityDurationMs;
		player.classList.add("invulnerable");
	}

	dashButton.disabled = true;
	window.setTimeout(() => {
		dashButton.disabled = false;
	}, PLAYER_RULES.dash.cooldownMs);
}

function isPerfectDodgeWindow() {
	return target.classList.contains("charging")
		&& targetAttackWindupRemaining > 0
		&& targetAttackWindupRemaining <= perfectDodgeWindowMs;
}

function damageTargetIfHit() {
	if (targetHp === 0) return;

	const playerCenterX = x + playerSize / 2;
	const playerCenterY = y + playerSize / 2;
	const targetCenterX = targetX + targetSize / 2;
	const targetCenterY = targetY + targetSize / 2;
	const distanceX = targetCenterX - playerCenterX;
	const distanceY = targetCenterY - playerCenterY;
	const distance = Math.hypot(distanceX, distanceY);
	const facingDot = distance === 0
		? 1
		: (distanceX / distance) * facingX + (distanceY / distance) * facingY;
	const maxDistance = playerSize / 2 + targetSize / 2 + PLAYER_RULES.attack.range;

	if (distance > maxDistance || facingDot < 0.5) return;

	targetHp = Math.max(0, targetHp - PLAYER_RULES.attack.damage);
	target.classList.remove("hit");
	void target.offsetWidth;
	target.classList.add("hit");
	updateTargetHp();

	if (targetHp === 0) {
		target.classList.remove("charging");
		target.classList.add("defeated");
		targetAttackWindupRemaining = 0;
		perfectDodgeArmed = false;
		endMatch("win");
	}
}

function targetDistanceFromPlayer() {
	const deltaX = targetX + targetSize / 2 - (x + playerSize / 2);
	const deltaY = targetY + targetSize / 2 - (y + playerSize / 2);
	return Math.hypot(deltaX, deltaY);
}

function resolveTargetAttack() {
	targetAttackWindupRemaining = 0;
	target.classList.remove("charging");

	if (invulnerabilityRemaining > 0) {
		if (perfectDodgeArmed) {
			perfectDodgeArmed = false;
			player.classList.remove("perfect-dodge");
			void player.offsetWidth;
			player.classList.add("perfect-dodge");
			showCombatStatus("PERFECT DODGE");
		} else {
			showCombatStatus("ATTACK EVADED!");
		}
		return;
	}

	if (targetDistanceFromPlayer() > TARGET_RULES.attackRange) {
		showCombatStatus("ATTACK EVADED!");
		return;
	}

	playerHp = Math.max(0, playerHp - TARGET_RULES.attackDamage);
	updatePlayerHp();
	player.classList.remove("hurt");
	void player.offsetWidth;
	player.classList.add("hurt");
	showCombatStatus(`HIT · -${TARGET_RULES.attackDamage} HP`);

	if (playerHp === 0) {
		player.classList.add("defeated");
		endMatch("loss");
	}
}

function moveTargetTowardPlayer(elapsed) {
	const deltaX = x + playerSize / 2 - (targetX + targetSize / 2);
	const deltaY = y + playerSize / 2 - (targetY + targetSize / 2);
	const distance = Math.hypot(deltaX, deltaY);
	if (distance === 0 || distance > TARGET_RULES.aggroRange) return;

	const directionX = deltaX / distance;
	const directionY = deltaY / distance;
	target.style.setProperty("--target-facing-angle", `${Math.atan2(directionY, directionX) * (180 / Math.PI)}deg`);
	if (distance <= TARGET_RULES.attackRange) return;

	const stopDistance = TARGET_RULES.attackRange - 5;
	const travelDistance = Math.min(TARGET_RULES.moveSpeed * elapsed, distance - stopDistance);
	targetX += directionX * travelDistance;
	targetY += directionY * travelDistance;
	const maxX = arena.clientWidth - targetSize;
	const maxY = arena.clientHeight - targetSize;
	targetX = Math.max(0, Math.min(targetX, maxX));
	targetY = Math.max(0, Math.min(targetY, maxY));
	target.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
}

function updateCombat(elapsed) {
	if (invulnerabilityRemaining > 0) {
		invulnerabilityRemaining = Math.max(0, invulnerabilityRemaining - elapsed * 1000);
		if (invulnerabilityRemaining === 0) {
			player.classList.remove("invulnerable");
			perfectDodgeArmed = false;
		}
	}

	if (targetHp === 0 || playerHp === 0 || matchOver) return;

	targetAttackCooldownRemaining = Math.max(0, targetAttackCooldownRemaining - elapsed * 1000);

	if (targetAttackWindupRemaining > 0) {
		targetAttackWindupRemaining -= elapsed * 1000;
		if (targetAttackWindupRemaining <= 0) resolveTargetAttack();
		return;
	}

	moveTargetTowardPlayer(elapsed);
	if (targetAttackCooldownRemaining === 0 && targetDistanceFromPlayer() <= TARGET_RULES.attackRange) {
		targetAttackWindupRemaining = TARGET_RULES.attackWindupMs;
		targetAttackCooldownRemaining = TARGET_RULES.attackCooldownMs;
		target.classList.add("charging");
		showCombatStatus("INCOMING ATTACK · DASH TO EVADE");
	}
}

function setupTouchControls() {
	const buttons = document.querySelectorAll(".touch-controls button");

	buttons.forEach((button) => {
		if (button.dataset.action) {
			button.addEventListener("pointerdown", (event) => {
				event.preventDefault();
				if (matchOver) return;
				if (button.dataset.action === "attack") attack();
				if (button.dataset.action === "dash") dash();
			});
			return;
		}

		const direction = button.dataset.direction;
		const release = (event) => touchDirections.delete(event.pointerId);

		button.addEventListener("pointerdown", (event) => {
			if (playerHp === 0 || matchOver) return;
			event.preventDefault();
			button.setPointerCapture(event.pointerId);
			touchDirections.set(event.pointerId, direction);
		});
		button.addEventListener("pointerup", release);
		button.addEventListener("pointercancel", release);
		button.addEventListener("lostpointercapture", release);
	});
}

function movePlayer(timestamp) {
	if (trainingScreen.hidden) {
		previousFrame = timestamp;
		requestAnimationFrame(movePlayer);
		return;
	}

	const elapsed = previousFrame === 0 ? 0 : Math.min((timestamp - previousFrame) / 1000, 0.05);
	previousFrame = timestamp;

	if (dashTimeRemaining > 0) {
		const dashStep = Math.min(elapsed, dashTimeRemaining);
		x += dashDirectionX * PLAYER_RULES.dash.speed * dashStep;
		y += dashDirectionY * PLAYER_RULES.dash.speed * dashStep;
		dashTimeRemaining -= dashStep;
		placePlayer();
		if (dashTimeRemaining === 0) player.classList.remove("dashing");
	} else {
		const direction = getMovementDirection();
		if (direction.x !== 0 || direction.y !== 0) {
			facingX = direction.x;
			facingY = direction.y;
			player.style.setProperty("--facing-angle", `${Math.atan2(facingY, facingX) * (180 / Math.PI)}deg`);
			x += direction.x * PLAYER_RULES.moveSpeed * elapsed;
			y += direction.y * PLAYER_RULES.moveSpeed * elapsed;
			placePlayer();
		}
	}
	updateCombat(elapsed);

	requestAnimationFrame(movePlayer);
}

function centerPlayer() {
	x = (arena.clientWidth - playerSize) / 2;
	y = (arena.clientHeight - playerSize) / 2;
	placePlayer();
}

window.addEventListener("keydown", handleKeyDown);
window.addEventListener("keyup", handleKeyUp);
window.addEventListener("blur", () => {
	keyboardDirections.clear();
	touchDirections.clear();
});
window.addEventListener("resize", () => {
	placePlayer();
	placeTarget();
});
player.addEventListener("animationend", (event) => {
	if (event.animationName === "slash-swing") player.classList.remove("attacking");
	if (event.animationName === "player-hit") player.classList.remove("hurt");
	if (event.animationName === "perfect-dodge-cue") player.classList.remove("perfect-dodge");
});
target.addEventListener("animationend", (event) => {
	if (event.animationName === "target-hit") target.classList.remove("hit");
});

setupTouchControls();
renderCharacterStats();
centerPlayer();
placeTarget();
updateTargetHp();
updatePlayerHp();
requestAnimationFrame(movePlayer);