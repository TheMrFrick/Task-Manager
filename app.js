//Dependencies are express body-parser nodemailer method-override pdfkit fs diskdb ejs
var express = require("express"),
    bodyParser = require("body-parser"),
    nodemailer = require('nodemailer'),
    methodOverride = require("method-override"),
    PDFDocument = require('pdfkit'),
    fs = require('fs'),
    db = require("diskdb");

var app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(methodOverride("_method"));
app.set('view engine', 'ejs');

db.connect("./", ["complete", "incomplete", "in_progress"]);

var sort_by = function (field, reverse, primer) {

    var key = primer ?
        function (x) { return primer(x[field]) } :
        function (x) { return x[field] };

    reverse = !reverse ? 1 : -1;

    return function (a, b) {
        return a = key(a), b = key(b), reverse * ((a > b) - (b > a));
    }
}

var incomplete = db.incomplete.find();
var complete = db.complete.find();
var in_progress = db.in_progress.find();

incomplete.sort(sort_by('title', false, function (a) { return a.toLowerCase() }));
complete.sort(sort_by('title', false, function (a) { return a.toLowerCase() }));
in_progress.sort(sort_by('title', false, function (a) { return a.toLowerCase() }));

var updateArray = function () {
    incomplete = db.incomplete.find();
    complete = db.complete.find();
    in_progress = db.in_progress.find();
    incomplete.sort(sort_by('title', false, function (a) { return a.toLowerCase() }));
    complete.sort(sort_by('title', false, function (a) { return a.toLowerCase() }));
    in_progress.sort(sort_by('title', false, function (a) { return a.toLowerCase() }));
}


var createDocument = function () {
    // # Create a document
    var doc = new PDFDocument;

    // # Pipe its output somewhere, like to a file or HTTP response
    // # See below for browser usage
    var d = new Date();
    var filename = 'TaskManagerReport' + d.getDate() + '-' + (d.getMonth() + 1) + '-' + d.getFullYear() + '.pdf';
    console.log(filename);
    doc.pipe(fs.createWriteStream(filename));

    // # Embed a font, set the font size, and render some text
    doc.font('public/css/fonts/Yataghan.ttf');
    // .fontSize(25)
    // .text('Some text with an embedded font!', 100, 100)



    var inc = db.incomplete.find();
    var inp = db.in_progress.find();
    var c = db.complete.find();

    doc.fontSize(25).text('Incomplete', 100, 100);
    doc.fontSize(12);
    inc.forEach(function (task) {
        doc.text(task.title + ":");
        doc.text('\t Date Given: ' + task.dateGiven);
        doc.text('\t Description: ' + task.description);
        doc.text('============================================');
    });

    doc.addPage();
    doc.fontSize(25).text('In Progress', 100, 100);
    doc.fontSize(12);
    inp.forEach(function (task) {
        doc.text(task.title + ":");
        doc.text('\t Date Given: ' + task.dateGiven);
        doc.text('\t Date Started: ' + task.dateStarted);
        doc.text('\t Description: ' + task.description);
        doc.text('\t Comments: ' + task.comments);
        doc.text('\t Status: ' + task.status);
        doc.text('============================================');
    });

    doc.addPage();
    doc.fontSize(25).text('Complete', 100, 100);
    doc.fontSize(12);
    c.forEach(function (task) {
        doc.text(task.title + ":");
        doc.text('\t Date Given: ' + task.dateGiven);
        doc.text('\t Date Started: ' + task.dateStarted);
        doc.text('\t Date Completed: ' + task.dateComplete);
        doc.text('\t Description: ' + task.description);
        doc.text('\t Comments: ' + task.comments);
        doc.text('============================================');
    });

    // # Finalize PDF file
    doc.end();
}


var sendEmail = function (toWho, fromWho, emailSubject, emailText) {
    // create reusable transporter object using the default SMTP transport
    var transporter = nodemailer.createTransport("SMTP", {
        //have to redo to your settings
    });

    // setup e-mail data with unicode symbols
    var mailOptions = {
        from: fromWho, // sender address
        to: toWho, // list of receivers
        subject: emailSubject, // Subject line
        text: emailText
    };

    // send mail with defined transport object
    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            return console.log(error);
        }
        console.log('Message sent: ' + info.response);
    });
}

var query = [
    { where: ["complete", "true"] }
];

app.get("/", function (req, res) {
    res.render("index",
        {
            incomplete: incomplete,
            complete: complete,
            progress: in_progress
        }
    );
});

app.get("/borehassetin", function (req, res) {
    res.render("fun");
})

app.get("/edit/:id", function (req, res) {
    var inc = db.incomplete.find({ _id: req.params.id });
    var inp = db.in_progress.find({ _id: req.params.id });
    if (inc.length > 0) {
        res.render("edit", { incomplete: inc });
    } else if (inp.length > 0) {
        res.render("edit", { incomplete: inp });
    }
});

app.put("/edit/:id/:status", function (req, res) {
    var query = {
        _id: req.params.id
    };
    var dataToUpdate = {
        status: req.params.status
    };
    var option = {
        multi: false,
        upsert: false
    };
    db.in_progress.update(query, dataToUpdate, option);
    updateArray();
    res.redirect("/");
})

app.put("/edit/:id", function (req, res) {
    var inc = db.incomplete.find({ _id: req.params.id });
    var inp = db.in_progress.find({ _id: req.params.id });
    var query = {
        _id: req.params.id
    };
    var dataToUpdate = {
        title: req.body.task.title,
        description: req.body.task.description,
        dateDue: req.body.task.dateDue,
        givenBy: req.body.task.givenBy,
        urgency: req.body.task.urgency
    };
    var option = {
        multi: false,
        upsert: false
    };

    if (inc.length > 0) {
        db.incomplete.update(query, dataToUpdate, option);
    } else if (inp.length > 0) {
        db.in_progress.update(query, dataToUpdate, option);
    }
    updateArray();
    res.redirect("/");
});

app.get("/new", function (req, res) {
    res.render("new");
});

app.post("/new", function (req, res) {
    // create reusable transporter object using the default SMTP transport
    var fromWho = req.body.task.givenBy;
    var to = ;//your email
    var subject = "New Task: " + req.body.task.title;
    var text = 'Task Name: ' + req.body.task.title + '\n' +
        'Task Description: ' + req.body.task.description + '\n' +
        'Urgency: ' + req.body.task.urgency;

    sendEmail(to, fromWho, subject, text);

    db.incomplete.save(req.body.task);
    updateArray();
    res.redirect("/");
});

app.get("/progress/:id/email", function (req, res) {
    var progress = db.in_progress.find({ _id: req.params.id });
    var subject = progress[0].title + ": Update";
    var text = "The following task has been updated:\t" + progress[0].title + "\n\n" +
        "Comments:\t" + progress[0].comments;
    sendEmail(progress[0].givenBy, "kfrick@fewaglobal.org", subject, text);
    res.redirect("/");
});

app.put("/progress/:id/comments", function (req, res) {
    var progress = db.in_progress.find({ _id: req.params.id });

    var query = {
        _id: req.params.id
    };
    var dataToUpdate = {
        comments: req.body.task.comments
    };
    var option = {
        multi: false,
        upsert: false
    };

    db.in_progress.update(query, dataToUpdate, option);
    // progress = db.in_progress.find({ _id: req.params.id });
    // var subject = progress[0].title + ": Update";
    // var text = "The following task has been updated: " + progress[0].title + "\n" +
    //     "Comments: " + progress[0].comments;
    // sendEmail(progress[0].givenBy, "kfrick@fewaglobal.org", subject, text);

    updateArray();
    res.redirect("/");
});

app.put("/progress/:id", function (req, res) {
    var date = new Date();

    var day = date.getDate();
    var month = date.getMonth() + 1;
    var year = date.getFullYear();

    if (month < 10) month = "0" + month;
    if (day < 10) day = "0" + day;

    var today = year + "-" + month + "-" + day;

    var query = {
        _id: req.params.id
    };
    var dataToUpdate = {
        status: "In-Progress",
        started: "yes",
        dateStarted: today
    };
    var option = {
        multi: false,
        upsert: false
    };

    db.incomplete.update(query, dataToUpdate, option);
    var update = db.incomplete.find({ _id: req.params.id });
    db.incomplete.remove({ _id: req.params.id });
    db.in_progress.save(update);
    updateArray();
    res.redirect("/");
});

app.put("/progress/complete/:id", function (req, res) {
    var query = {
        _id: req.params.id
    };
    var dataToUpdate = {
        completed: "no",
    };
    var option = {
        multi: false,
        upsert: false
    };

    db.complete.update(query, dataToUpdate, option);
    var update = db.complete.find({ _id: req.params.id });
    db.complete.remove({ _id: req.params.id });
    db.in_progress.save(update);
    updateArray();
    res.redirect("/");
});

app.put("/complete/:id", function (req, res) {
    var task = db.in_progress.find({ _id: req.params.id });

    var subject = task[0].title + ": Completed";
    var text = "The following task was completed: " + task[0].title;

    sendEmail(task[0].givenBy, "kfrick@fewaglobal.org", subject, text);

    var date = new Date();

    var day = date.getDate();
    var month = date.getMonth() + 1;
    var year = date.getFullYear();

    if (month < 10) month = "0" + month;
    if (day < 10) day = "0" + day;

    var today = year + "-" + month + "-" + day;

    var query = {
        _id: req.params.id
    };
    var dataToUpdate = {
        complete: "complete",
        dateComplete: today
    };
    var option = {
        multi: false,
        upsert: false
    };

    db.in_progress.update(query, dataToUpdate, option);
    var update = db.in_progress.find({ _id: req.params.id });
    db.in_progress.remove({ _id: req.params.id });
    db.complete.save(update);
    updateArray();
    res.redirect("/");
});

app.delete("/delete/:id", function (req, res) {
    var inc = db.incomplete.find({ _id: req.params.id });
    var inp = db.in_progress.find({ _id: req.params.id });
    var c = db.complete.find({ _id: req.params.id });
    if (inc.length > 0) {
        db.incomplete.remove({ _id: req.params.id });
    } else if (inp.length > 0) {
        db.in_progress.remove({ _id: req.params.id });
    } else {
        db.complete.remove({ _id: req.params.id });
    }
    updateArray();
    res.redirect("/");
});

app.get("/sort/name/:reverse", function (req, res) {
    var revers;
    if (req.params.reverse === "true") {
        revers = true;
    } else {
        revers = false;
    }
    incomplete = db.incomplete.find();
    complete = db.complete.find();
    in_progress = db.in_progress.find();
    incomplete.sort(sort_by('title', revers, function (a) { return a.toLowerCase() }));
    complete.sort(sort_by('title', revers, function (a) { return a.toLowerCase() }));
    in_progress.sort(sort_by('title', revers, function (a) { return a.toLowerCase() }));

    // updateArray();
    res.redirect("/");
});

app.get("/sort/urgency", function (req, res) {
    incomplete = db.incomplete.find();
    complete = db.complete.find();
    in_progress = db.in_progress.find();
    incomplete.sort(sort_by('urgency', true, function (a) { return a.toLowerCase() }));
    complete.sort(sort_by('urgency', true, function (a) { return a.toLowerCase() }));
    in_progress.sort(sort_by('urgency', true, function (a) { return a.toLowerCase() }));
    res.redirect("/");
});

app.get("/sort/date_given", function(req,res){
    incomplete = db.incomplete.find();
    complete = db.complete.find();
    in_progress = db.in_progress.find();
    incomplete.sort(sort_by('dateGiven', true, function (a) { return a.toLowerCase() }));
    complete.sort(sort_by('dateGiven', true, function (a) { return a.toLowerCase() }));
    in_progress.sort(sort_by('dateGiven', true, function (a) { return a.toLowerCase() }));
    res.redirect("/");
})

app.get("/createdoc", function (req, res) {
    createDocument();
    res.redirect("/");
});

app.listen(8080, function (err) {
    if (err) {
        console.log(err);
    }
    console.log("Running on http://localhost:8080");
});
