// modals/index.js — All modal definitions
const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  // FIX #2: removed unused StringSelectMenuBuilder import
} = require('discord.js');

function registerModal() {
  return new ModalBuilder()
    .setCustomId('modal_register')
    .setTitle('ลงทะเบียนบัญชี')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('firstName').setLabel('ชื่อ').setStyle(TextInputStyle.Short).setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('lastName').setLabel('นามสกุล').setStyle(TextInputStyle.Short).setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('studentId').setLabel('รหัสนักศึกษา').setStyle(TextInputStyle.Short).setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('password').setLabel('รหัสผ่าน').setStyle(TextInputStyle.Short).setRequired(true).setMinLength(6)
      )
    );
}

function loginModal() {
  return new ModalBuilder()
    .setCustomId('modal_login')
    .setTitle('เข้าสู่ระบบ')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('studentId').setLabel('รหัสนักศึกษา').setStyle(TextInputStyle.Short).setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('password').setLabel('รหัสผ่าน').setStyle(TextInputStyle.Short).setRequired(true)
      )
    );
}

function homeworkModal(subjectCode) {
  return new ModalBuilder()
    .setCustomId(`modal_add_homework_${subjectCode}`)
    .setTitle(`เพิ่มการบ้าน — ${subjectCode}`)
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('title').setLabel('ชื่องาน').setStyle(TextInputStyle.Short).setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('details').setLabel('รายละเอียด').setStyle(TextInputStyle.Paragraph).setRequired(false)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('imageUrl').setLabel('URL รูปภาพ (Discord CDN)').setStyle(TextInputStyle.Short).setRequired(false)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('link').setLabel('ลิงก์ที่เกี่ยวข้อง').setStyle(TextInputStyle.Short).setRequired(false)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('dueDate')
          .setLabel('กำหนดส่ง (YYYY-MM-DD HH:MM)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('เช่น 2025-12-31 23:59')
      )
    );
}

function addSubjectModal() {
  return new ModalBuilder()
    .setCustomId('modal_add_subject')
    .setTitle('เพิ่มวิชาใหม่')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('subjectCode').setLabel('รหัสวิชา').setStyle(TextInputStyle.Short).setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('subjectName').setLabel('ชื่อวิชา').setStyle(TextInputStyle.Short).setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('credits').setLabel('หน่วยกิต').setStyle(TextInputStyle.Short).setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('instructor').setLabel('ชื่ออาจารย์').setStyle(TextInputStyle.Short).setRequired(true)
      )
    );
}

function deleteHomeworkModal() {
  return new ModalBuilder()
    .setCustomId('modal_delete_homework')
    .setTitle('ลบการบ้าน')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('homeworkId')
          .setLabel('Homework ID ที่ต้องการลบ')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('ดู ID จากปุ่ม ดูการบ้าน')
      )
    );
}

function removeUserModal() {
  return new ModalBuilder()
    .setCustomId('modal_remove_user')
    .setTitle('ลบผู้ใช้')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('studentId')
          .setLabel('รหัสนักศึกษาที่ต้องการลบ')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );
}

module.exports = {
  registerModal,
  loginModal,
  homeworkModal,
  addSubjectModal,
  deleteHomeworkModal,
  removeUserModal,
};
