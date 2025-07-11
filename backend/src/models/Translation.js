const mongoose = require('mongoose');

const translationSchema = new mongoose.Schema({
  originalText: {
    type: String,
    required: true,
    trim: true
  },
  translatedText: {
    type: String,
    required: true,
    trim: true
  },
  fromLanguage: {
    type: String,
    required: true,
    default: 'he'
  },
  toLanguage: {
    type: String,
    required: true,
    default: 'en'
  }
}, {
  timestamps: true
});

// Create compound index for efficient lookups
translationSchema.index({ 
  originalText: 1, 
  fromLanguage: 1, 
  toLanguage: 1 
}, { 
  unique: true 
});

// Static method to find or create translation
translationSchema.statics.findOrCreate = async function(originalText, translatedText, fromLanguage = 'he', toLanguage = 'en') {
  let translation = await this.findOne({
    originalText,
    fromLanguage,
    toLanguage
  });

  if (!translation) {
    translation = new this({
      originalText,
      translatedText,
      fromLanguage,
      toLanguage
    });
    await translation.save();
  }

  return translation;
};

const Translation = mongoose.model('Translation', translationSchema);

module.exports = Translation;
