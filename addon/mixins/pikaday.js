/* globals Pikaday */
import Mixin from '@ember/object/mixin';

import { assign } from '@ember/polyfills';
import { isPresent } from '@ember/utils';
import { run, next } from '@ember/runloop';
import { getProperties, computed } from '@ember/object';
import moment from 'moment';

export default Mixin.create({
  _options: computed('options', 'i18n', {
    get() {
      let options = this._defaultOptions();

      if (isPresent(this.get('i18n'))) {
        if (isPresent(this.get('i18n').t)) {
          options.i18n = {
            previousMonth: this.get('i18n')
              .t('previousMonth')
              .toString(),
            nextMonth: this.get('i18n')
              .t('nextMonth')
              .toString(),
            months: this.get('i18n')
              .t('months')
              .toString()
              .split(','),
            weekdays: this.get('i18n')
              .t('weekdays')
              .toString()
              .split(','),
            weekdaysShort: this.get('i18n')
              .t('weekdaysShort')
              .toString()
              .split(',')
          };
        } else {
          options.i18n = this.get('i18n');
        }
      }
      if (isPresent(this.get('position'))) {
        options.position = this.get('position');
      }
      if (isPresent(this.get('reposition'))) {
        options.reposition = this.get('reposition');
      }

      assign(options, this.get('options') || {});
      return options;
    }
  }),

  _defaultOptions() {
    const firstDay = this.get('firstDay');

    return {
      field: this.get('field'),
      container: this.get('pikadayContainer'),
      bound: this.get('pikadayContainer') ? false : true,
      onOpen: run.bind(this, this.onPikadayOpen),
      onClose: run.bind(this, this.onPikadayClose),
      onSelect: run.bind(this, this.onPikadaySelect),
      onDraw: run.bind(this, this.onPikadayRedraw),
      firstDay: typeof firstDay !== 'undefined' ? parseInt(firstDay, 10) : 1,
      format: this.get('format') || 'DD.MM.YYYY',
      yearRange: this.determineYearRange(),
      minDate: this.get('minDate') || null,
      maxDate: this.get('maxDate') || null,
      defaultDate: this.get('defaultDate') || null,
      setDefaultDate: !!this.get('defaultDate'),
      theme: this.get('theme') || null,
      clearInvalidDate: this.get('clearInvalidDate') || false
    };
  },

  /**
   * When updating attrs, we need to reset some things in case they've changed.
   * @public
   * @memberOf {Mixins.Pikaday}
   * @return {undefined}
   */
  didUpdateAttrs() {
    this.set(
      'cancelToken',
      run.later(() => {
        // Do not set or update anything when the component is destroying.
        if (this.get('isDestroying') || this.get('isDestroyed')) {
          return;
        }

        this.setMinDate();
        this.setMaxDate();
        this.setPikadayDate();

        if (this.get('options')) {
          this._updateOptions();
        }
      })
    );
  },

  didRender() {
    this._super();
    this.autoHideOnDisabled();
  },

  setupPikaday() {
    let pikaday = new Pikaday(this.get('_options'));

    if (this.get('defaultDate')) {
      this.set('value', this.get('defaultDate'));
    }

    this.set('pikaday', pikaday);
    this.setPikadayDate();
  },

  willDestroyElement() {
    this._super();
    this.get('pikaday').destroy();
    run.cancel(this.get('cancelToken'));
  },

  setPikadayDate: function() {
    const format = 'YYYY-MM-DD';
    const value = this.get('value');

    if (!value) {
      this.get('pikaday').setDate(value, true);
    } else {
      const date = this.get('useUTC')
        ? moment(moment.utc(value).format(format), format).toDate()
        : value;

      this.get('pikaday').setDate(date, true);
    }
  },

  setMinDate: function() {
    let { pikaday, minDate, value } = getProperties(this, [
      'pikaday',
      'minDate',
      'value'
    ]);

    if (minDate) {
      try {
        minDate = minDate.getTime();
      } catch (e) {
        minDate = new Date(minDate);
      }
      const _minDate = new Date(minDate);
      pikaday.setMinDate(_minDate);

      // If the current date is lower than minDate we set date to minDate
      next(() => {
        if (
          value &&
          moment(value, this.get('format')).isBefore(minDate, 'day')
        ) {
          pikaday.setDate(minDate);
        }
      });
    } else {
      pikaday.setMinDate(null);
    }
  },

  setMaxDate: function() {
    let { pikaday, maxDate, value } = getProperties(this, [
      'pikaday',
      'maxDate',
      'value'
    ]);

    if (maxDate) {
      try {
        maxDate = maxDate.getTime();
      } catch (e) {
        maxDate = new Date(maxDate);
      }
      const _maxDate = new Date(maxDate);
      pikaday.setMaxDate(_maxDate);

      // If the current date is greater than maxDate we set date to maxDate
      next(() => {
        if (value > maxDate) {
          pikaday.setDate(maxDate);
        }
      });
    } else {
      pikaday.setMaxDate(null);
    }
  },

  onOpen() {},
  onClose() {},
  onSelection() {},
  onDraw() {},

  onPikadaySelect: function() {
    this.userSelectedDate();
  },

  onPikadayRedraw: function() {
    this.get('onDraw')();
  },

  userSelectedDate: function() {
    var selectedDate = this.get('pikaday').getDate();

    if (this.get('useUTC')) {
      selectedDate = moment
        .utc([
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          selectedDate.getDate()
        ])
        .toDate();
    }

    this.get('onSelection')(selectedDate);
  },

  determineYearRange: function() {
    var yearRange = this.get('yearRange');

    if (yearRange) {
      if (yearRange.indexOf(',') > -1) {
        var yearArray = yearRange.split(',');

        if (yearArray[1] === 'currentYear') {
          yearArray[1] = new Date().getFullYear();
        }

        return yearArray;
      } else {
        return yearRange;
      }
    } else {
      return 10;
    }
  },

  autoHideOnDisabled() {
    if (this.get('disabled') && this.get('pikaday')) {
      this.get('pikaday').hide();
    }
  },

  _updateOptions() {
    this.get('pikaday').config(this.get('_options'));
  },

  verifyInvalidDate(element) {
    if (this.get('clearInvalidDate')) {
      var validDate = moment(element.val(), this.get('format'),true ).isValid();
      
      if (!validDate) {
        element.val(null);
        this.set('value', null);
        this.get('onSelection')(null);
      }
    }
  }
});
