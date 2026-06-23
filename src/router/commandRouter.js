const { handleHelp } = require('../commands/help');
const { handlePlan } = require('../commands/plan');
const { handleHari } = require('../commands/hari');
const { handleDompet } = require('../commands/dompet');
const { handleSaldo } = require('../commands/saldo');
const { handleStart } = require('../commands/start');
const { handleEdit, handleHapus } = require('../handlers/edit');
const { handleDetail } = require('../commands/detail');
const { handleRiwayat } = require('../commands/riwayat');
const { handleNusa } = require('../commands/nusa');
const { handleConnectSheet } = require('../commands/connectSheet');

const commands = {
  '/start': handleStart,
  '/connect-sheet': handleConnectSheet,
  '/help': handleHelp,
  '/plan': handlePlan,
  '/hari': handleHari,
  '/dompet': handleDompet,
  '/saldo': handleSaldo,
  '/edit': handleEdit,
  '/hapus': handleHapus,
  '/detail': handleDetail,
  '/riwayat': handleRiwayat,
  '/nusa': handleNusa
};

async function routeCommand(bot, chatId, user, input) {
  const cmd = input.split(' ')[0];
  const handler = commands[cmd];

  if (!handler) {
    return false;
  }

  await handler(bot, chatId, user, input);

  return true;
}

module.exports = {
  routeCommand
};