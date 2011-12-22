#!/usr/bin/env node

// Imports ====================================================================
var fs = require("fs"),
    sys = require("sys"),
    path = require("path"),
    themes = require("./themes"),
    cssmin = require("./lib/cssmin").cssmin,
    kendoBuild = require("./kendo-build"),
    kendoExamples = require("./examples"),
    kendoScripts = require("./kendo-scripts"),
    copyDir = kendoBuild.copyDirSyncRecursive,
    processFiles = kendoBuild.processFilesRecursive,
    mkdir = kendoBuild.mkdir,
    readText = kendoBuild.readText,
    template = kendoBuild.template,
    writeText = kendoBuild.writeText,
    zip = kendoBuild.zip;

// Configuration ==============================================================
var bundles = [{
    name: "kendoui.web-dataviz",
    suites: ["web", "dataviz"],
    license: "commercial",
    eula: "eula",
    hasSource: true
}, {
    name: "kendoui.web-dataviz",
    suites: ["web", "dataviz"],
    license: "trial",
    eula: "eula",
    hasSource: false
}, {
    name: "kendoui.web-dataviz",
    suites: ["web", "dataviz"],
    license: "open-source",
    eula: "eula",
    hasSource: true
}];

var VERSION = kendoBuild.generateVersion(),
    LATEST = "latest",
    INDEX = "index.html",
    SCRIPTS_ROOT = "src",
    STYLES_ROOT = "styles",
    DEMOS_ROOT = path.join("demos", "mvc"),
    TEMPLATES_ROOT = path.join("build", "templates"),
    SUITE_INDEX = path.join(TEMPLATES_ROOT, "suite-index.html"),
    BUNDLE_INDEX = path.join(TEMPLATES_ROOT, "bundle-index.html"),
    EXAMPLE_TEMPLATE = path.join(TEMPLATES_ROOT, "example.html"),
    CONTENT_ROOT = "content",
    VIEWS_ROOT = "Views",
    LEGAL_ROOT = path.join("resources", "legal"),
    SRC_LICENSE = "src-license.txt",
    THIRD_PARTY_ROOT = "third-party",
    DROP_LOCATION = "release",
    DEPLOY_ROOT = "deploy",
    DEPLOY_SOURCE = "source",
    DEPLOY_SCRIPTS = "js",
    DEPLOY_STYLES = "styles",
    DEPLOY_EXAMPLES = "examples",
    DEPLOY_LEGAL_ROOT = "LicenseAgreements",
    DEPLOY_THIRD_PARTY_ROOT = "ThirdParty",
    DEPLOY_ONLINEEXAMPLES = "online-examples",
    ONLINE_EXAMPLES_PACKAGE = "kendoui-online-examples.zip";

// Implementation ==============================================================
var startDate = new Date();

function initWorkspace() {
    kendoBuild.rmdirSyncRecursive(DEPLOY_ROOT);

    mkdir(DEPLOY_ROOT);
    mkdir(DROP_LOCATION);
}

function deployScripts(root, license, copySource) {
    var scriptsDest = path.join(root, DEPLOY_SCRIPTS),
        sourceRoot = path.join(root, DEPLOY_SOURCE),
        sourceDest = path.join(sourceRoot, DEPLOY_SCRIPTS);

    mkdir(scriptsDest);
    kendoScripts.deployScripts(SCRIPTS_ROOT, scriptsDest, license, true);

    if (copySource) {
        mkdir(sourceRoot);
        mkdir(sourceDest);
        kendoScripts.deployScripts(SCRIPTS_ROOT, sourceDest, license, false);
    }
}

function deployStyles(root, license, copySource) {
    var stylesDest = path.join(root, DEPLOY_STYLES),
        sourceRoot = path.join(root, DEPLOY_SOURCE),
        sourceDest = path.join(sourceRoot, DEPLOY_STYLES);

    mkdir(stylesDest);
    copyDir(STYLES_ROOT, stylesDest, false, /\.(css|png|jpg|jpeg|gif)$/i);
    processFiles(stylesDest, /\.css$/, function(fileName) {
        var css = kendoBuild.stripBOM(readText(fileName)),
            minified = license + cssmin(css);

        writeText(fileName, minified);
        fs.renameSync(fileName, fileName.replace(".css", ".min.css"));
    });
    kendoBuild.rmdirSyncRecursive(path.join(stylesDest, "mobile"));

    if (copySource) {
        mkdir(sourceRoot);
        mkdir(sourceDest);

        copyDir(STYLES_ROOT, sourceDest, false, /\.(less|css|png|jpg|jpeg|gif)$/i);
        processFiles(sourceDest, /\.(less|css)$/, function(fileName) {
            var css = license + kendoBuild.stripBOM(readText(fileName));

            writeText(fileName, css);
        });
        kendoBuild.rmdirSyncRecursive(path.join(sourceDest, "mobile"));
    }
}

function deployLicenses(root, bundle) {
    var deployLegalRoot = path.join(root, DEPLOY_LEGAL_ROOT),
        deployThirdPartyRoot = path.join(root, DEPLOY_LEGAL_ROOT, DEPLOY_THIRD_PARTY_ROOT);

    kendoBuild.mkdir(deployLegalRoot);
    kendoBuild.mkdir(deployThirdPartyRoot);

    copyDir(
        path.join(LEGAL_ROOT, bundle.eula),
        deployLegalRoot
    );

    copyDir(
        path.join(LEGAL_ROOT, THIRD_PARTY_ROOT),
        deployThirdPartyRoot
    );
}

function deployExamples(root, bundle) {
    var examplesRoot = path.join(root, DEPLOY_EXAMPLES),
        viewsRoot = path.join(DEMOS_ROOT, VIEWS_ROOT),
        stylesPath = "../../../styles/$2.min.css",
        scriptsPath = "../../../js/$2.min.js",
        exampleTemplate = template(readText(EXAMPLE_TEMPLATE)),
        suiteIndexTemplate = template(readText(SUITE_INDEX)),
        bundleIndexTemplate = template(readText(BUNDLE_INDEX)),
        bundleIndex = bundleIndexTemplate(bundle);

    if (bundle.hasSource) {
        stylesPath = "../../../source/styles/$2.css";
        scriptsPath = "../../../source/js/$2.js";
    }

    kendoBuild.mkdir(examplesRoot);

    writeText(path.join(examplesRoot, INDEX), bundleIndex)

    copyDir(
        path.join(DEMOS_ROOT, CONTENT_ROOT),
        path.join(examplesRoot, CONTENT_ROOT)
    );

    bundle.suites.forEach(function(suite) {
        var navigationFile = path.join(DEMOS_ROOT, "App_Data", suite + ".nav.json"),
            navigationData = readText(navigationFile),
            navigation = JSON.parse(navigationData),
            suiteDest = path.join(examplesRoot, suite),
            suiteIndex = suiteIndexTemplate(navigation);

        kendoBuild.mkdir(suiteDest);
        writeText(path.join(suiteDest, INDEX), suiteIndex)

        for (var category in navigation) {
            for (var widgetIx = 0, widgets = navigation[category]; widgetIx < widgets.length; widgetIx++) {
                for (var exampleIx = 0, examples = widgets[widgetIx].items; exampleIx < examples.length; exampleIx++) {
                    var example = examples[exampleIx],
                    viewName = example.url.replace("html", "cshtml"),
                    fileName = path.join(viewsRoot, suite, viewName),
                    outputName = path.join(suiteDest, example.url),
                    params = {
                        body: readText(fileName),
                        title: example.text
                    };

                    kendoBuild.mkdir(path.dirname(outputName));
                    writeText(outputName, exampleTemplate(params));
                }
            }
        }
    });
}

function buildBundle(bundle, success) {
    var name = bundle.name,
        license = bundle.license,
        deployName = name + "." + VERSION + "." + license,
        root = path.join(DEPLOY_ROOT, name + "." + license),
        srcLicenseTemplate = readText(path.join(LEGAL_ROOT, SRC_LICENSE)),
        srcLicense = template(srcLicenseTemplate)({ version: VERSION, year: startDate.getFullYear() }),
        packageName = path.join(DROP_LOCATION, deployName + ".zip"),
        packageNameLatest = packageName.replace(VERSION, LATEST);

    console.log("Building " + deployName);
    mkdir(root);

    console.log("Deploying scripts");
    deployScripts(root, srcLicense, bundle.hasSource);

    console.log("Deploying styles");
    deployStyles(root, srcLicense, bundle.hasSource);

    console.log("Deploying licenses");
    deployLicenses(root, bundle);

    console.log("Deploying examples");
    deployExamples(root, bundle);

    zip(packageName, root, function() {
        kendoBuild.copyFileSync(packageName, packageNameLatest);

        if (success) {
            success();
        }
    });
}

function buildAllBundles(success, bundleIx) {
    bundleIx = bundleIx || 0;

    if (bundleIx < bundles.length) {
        buildBundle(bundles[bundleIx], function() {
            buildAllBundles(success, ++bundleIx);
        });
    } else {
        success();
    }
}

function buildOnlineExamples(success) {
    var onlineExamplesRoot = path.join(DEPLOY_ROOT, DEPLOY_ONLINEEXAMPLES),
        packageName = path.join(DROP_LOCATION, ONLINE_EXAMPLES_PACKAGE);

    // XBuild
    // zip(packageName, onlineExamplesRoot, success);
}

console.log("Build starting at " + startDate);
initWorkspace();

console.log("Merging multi-part scripts");
kendoScripts.mergeScripts();

console.log("Building themes");
themes.build();

buildAllBundles(function() {
    console.log("Building online examples");
    buildOnlineExamples(function() {
        console.log("Time elapsed: " + ((new Date() - startDate) / 1000) + " seconds");
    });
});

