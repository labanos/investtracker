
<%@ page import="investtrckr.Investment" %>
<!DOCTYPE html>
<html>
	<head>
		<meta name="layout" content="main">
		<g:set var="entityName" value="${message(code: 'investment.label', default: 'Investment')}" />
		<title><g:message code="default.show.label" args="[entityName]" /></title>
	</head>
	<body>
		<a href="#show-investment" class="skip" tabindex="-1"><g:message code="default.link.skip.label" default="Skip to content&hellip;"/></a>
		<div class="nav" role="navigation">
			<ul>
				<li><a class="home" href="${createLink(uri: '/')}"><g:message code="default.home.label"/></a></li>
				<li><g:link class="list" action="list"><g:message code="default.list.label" args="[entityName]" /></g:link></li>
				<li><g:link class="create" action="create"><g:message code="default.new.label" args="[entityName]" /></g:link></li>
			</ul>
		</div>
		<div id="show-investment" class="content scaffold-show" role="main">
			<h1><g:message code="default.show.label" args="[entityName]" /></h1>
			<g:if test="${flash.message}">
			<div class="message" role="status">${flash.message}</div>
			</g:if>
			<ol class="property-list investment">
			
				<g:if test="${investmentInstance?.name}">
				<li class="fieldcontain">
					<span id="name-label" class="property-label"><g:message code="investment.name.label" default="Name" /></span>
					
						<span class="property-value" aria-labelledby="name-label"><g:fieldValue bean="${investmentInstance}" field="name"/></span>
					
				</li>
				</g:if>
			
				<g:if test="${investmentInstance?.tracker}">
				<li class="fieldcontain">
					<span id="tracker-label" class="property-label"><g:message code="investment.tracker.label" default="Tracker" /></span>
					
						<span class="property-value" aria-labelledby="tracker-label"><g:fieldValue bean="${investmentInstance}" field="tracker"/></span>
					
				</li>
				</g:if>
			
				<g:if test="${investmentInstance?.purchases}">
				<li class="fieldcontain">
					<span id="purchases-label" class="property-label"><g:message code="investment.purchases.label" default="Purchases" /></span>
					
						<g:each in="${investmentInstance.purchases}" var="p">
						<span class="property-value" aria-labelledby="purchases-label"><g:link controller="purchase" action="show" id="${p.id}">${p?.encodeAsHTML()}</g:link></span>
						</g:each>
					
				</li>
				</g:if>
			
				<g:if test="${investmentInstance?.sales}">
				<li class="fieldcontain">
					<span id="sales-label" class="property-label"><g:message code="investment.sales.label" default="Sales" /></span>
					
						<g:each in="${investmentInstance.sales}" var="s">
						<span class="property-value" aria-labelledby="sales-label"><g:link controller="sale" action="show" id="${s.id}">${s?.encodeAsHTML()}</g:link></span>
						</g:each>
					
				</li>
				</g:if>
			
			</ol>
			<g:form>
				<fieldset class="buttons">
					<g:hiddenField name="id" value="${investmentInstance?.id}" />
					<g:link class="edit" action="edit" id="${investmentInstance?.id}"><g:message code="default.button.edit.label" default="Edit" /></g:link>
					<g:actionSubmit class="delete" action="delete" value="${message(code: 'default.button.delete.label', default: 'Delete')}" onclick="return confirm('${message(code: 'default.button.delete.confirm.message', default: 'Are you sure?')}');" />
				</fieldset>
			</g:form>
		</div>
	</body>
</html>
