// Include gulp
var gulp = require('gulp');

// Include Our Plugins
var jshint        = require('gulp-jshint');
var sass          = require('gulp-sass');
var concat        = require('gulp-concat');
var concatCss     = require('gulp-concat-css');
var uglify        = require('gulp-uglify');
var rename        = require('gulp-rename');
var templateCache = require('gulp-angular-templatecache');
var addStream     = require('add-stream');

// Lint Task
gulp.task('lint', function() {
    return gulp.src(['source/map/**/*.js','!source/vendor{,/**}'])
        .pipe(jshint())
        .pipe(jshint.reporter('default'));
});

// Compile Our Sass
// gulp.task('sass', function() {
//     return gulp.src('scss/*.scss')
//         .pipe(sass())
//         .pipe(gulp.dest('css'));
// });

//Concatenate & Minify JS
gulp.task('scripts', function() {
 return gulp.src('source/map/**/*.js')
 	 .pipe(addStream.obj(prepareTemplates()))
     .pipe(concat('ga-explorer-map.js'))
     .pipe(gulp.dest('dist'))
     .pipe(rename('ga-explorer-map.min.js'))
     .pipe(uglify())
     .pipe(gulp.dest('dist'));
});

// Watch Files For Changes
gulp.task('watch', function() {
    // We watch both JS and HTML files.
    gulp.watch('source/map/**/*(*.js|*.html)', ['lint', 'scripts']);
    gulp.watch('source/map/**/*.css', ['concatCss']);
    //gulp.watch('scss/*.scss', ['sass']);
});


gulp.task('concatCss', function () {
  return gulp.src('source/map/**/*.css')
    .pipe(concatCss("ga-explorer-map.css"))
    .pipe(gulp.dest('dist/'));
});

gulp.task('vendors', function() {
  return gulp.src(['source/vendor/**'])
      .pipe(gulp.dest('dist/vendor'));
});

// Default Task
gulp.task('default', ['lint', 'scripts', 'concatCss', 'vendors', 'watch']);

function prepareTemplates() {
   return gulp.src('source/map/**/*.html')
      .pipe(templateCache({root:"map", module:"exp.map.templates", standalone : true}));
}

